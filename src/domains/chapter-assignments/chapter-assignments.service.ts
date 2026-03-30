import type { DbTransaction } from '@/lib/types';

import { db } from '@/db';
import { ProjectPolicy } from '@/domains/projects/project.policy';
import * as projectHandler from '@/domains/projects/projects.service';
import { resolveIsProjectMember } from '@/domains/projects/users/project-users.service';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type {
  ChapterAssignmentRecord,
  ChapterAssignmentResponse,
  ChapterAssignmentStatus,
  CreateChapterAssignmentRequestData,
  UpdateChapterAssignmentRequestData,
} from './chapter-assignments.types';

import * as repo from './chapter-assignments.repository';

export function toChapterAssignmentResponse(
  record: ChapterAssignmentRecord
): ChapterAssignmentResponse {
  return {
    id: record.id,
    projectUnitId: record.projectUnitId,
    bibleId: record.bibleId,
    bookId: record.bookId,
    chapterNumber: record.chapterNumber,
    assignedUserId: record.assignedUserId,
    peerCheckerId: record.peerCheckerId,
    status: record.status,
    submittedTime: record.submittedTime,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function getChapterAssignment(id: number) {
  return repo.findByIdWithOrg(id);
}

export async function getChapterAssignmentWithAuth(
  chapterAssignmentId: number,
  currentUser: {
    id: number;
    role: number;
    roleName: string;
    organization: number;
  }
) {
  // Get assignment with auth context in single query
  const assignmentResult = await repo.findByIdWithAuthContext(
    chapterAssignmentId,
    currentUser.id,
    currentUser.roleName
  );
  if (!assignmentResult.ok) {
    return assignmentResult;
  }

  const assignment = assignmentResult.data;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  // Get project data for policy check (still using existing handlers)
  const projectResult = await projectHandler.getProjectById(assignment.projectId);
  if (!projectResult.ok) {
    return err(ErrorCode.CHAPTER_ASSIGNMENT_NOT_FOUND); // Consistent with current behavior
  }

  // Authorization check - moved from route handler
  const isProjectMember =
    currentUser.roleName === 'translator'
      ? assignment.isProjectMember
      : await resolveIsProjectMember(assignment.projectId, currentUser.id, currentUser.roleName);

  if (!ProjectPolicy.read(policyUser, projectResult.data, isProjectMember)) {
    return err(ErrorCode.FORBIDDEN);
  }

  return ok(toChapterAssignmentResponse(assignment));
}

export function getAssignmentForVerse(projectUnitId: number, bibleTextId: number) {
  return repo.findForVerse(projectUnitId, bibleTextId);
}

export async function createChapterAssignment(data: CreateChapterAssignmentRequestData) {
  return db.transaction(async (tx) => {
    try {
      const assignment = await repo.insert(data, tx);

      await repo.insertStatusHistory(tx, assignment.id, 'not_started');

      if (assignment.assignedUserId) {
        await repo.insertUserAssignmentHistory(
          tx,
          assignment.id,
          assignment.assignedUserId,
          'drafter',
          'not_started'
        );
      }
      if (assignment.peerCheckerId) {
        await repo.insertUserAssignmentHistory(
          tx,
          assignment.id,
          assignment.peerCheckerId,
          'peer_checker',
          'not_started'
        );
      }

      return ok(toChapterAssignmentResponse(assignment));
    } catch (e) {
      logger.error({ cause: e, message: 'Failed to create chapter assignment', context: { data } });
      return err(ErrorCode.INTERNAL_ERROR);
    }
  });
}

/**
 * Bulk-create chapter assignments for a project unit from bible texts.
 * Internal cross-domain function called during project-unit setup —
 * returns raw records since this is never sent directly to a client.
 */
export async function createChapterAssignmentForProjectUnit(
  projectUnitId: number,
  bibleId: number,
  bookIds: number[],
  tx: DbTransaction
) {
  try {
    const chapters = await repo.findChaptersForProjectUnit(bibleId, bookIds, tx);
    if (chapters.length === 0) return ok([]);

    const records = chapters.map((c) => ({
      projectUnitId,
      bibleId: c.bibleId,
      bookId: c.bookId,
      chapterNumber: c.chapterNumber,
      assignedUserId: null as null,
      peerCheckerId: null as null,
    }));

    const inserted = await repo.insertMany(records, tx);
    return ok(inserted);
  } catch (e) {
    logger.error({
      cause: e,
      message: 'Failed to create chapter assignments for project unit',
      context: { projectUnitId, bibleId, bookIds },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function updateChapterAssignment(
  id: number,
  data: UpdateChapterAssignmentRequestData,
  externalTx?: DbTransaction
) {
  const exec = async (tx: DbTransaction) => {
    try {
      const current = await repo.findById(id, tx);
      if (!current) return err(ErrorCode.CHAPTER_ASSIGNMENT_NOT_FOUND);

      const finalData = applyAutoTransition(current, data);
      const updated = await repo.update(id, finalData, tx);
      if (!updated) return err(ErrorCode.CHAPTER_ASSIGNMENT_NOT_FOUND);

      await recordStatusChange(tx, current, updated);
      await recordUserAssignmentChanges(tx, current, updated, data);

      return ok(toChapterAssignmentResponse(updated));
    } catch (e) {
      logger.error({
        cause: e,
        message: 'Failed to update chapter assignment',
        context: { chapterAssignmentId: id, data },
      });
      return err(ErrorCode.INTERNAL_ERROR);
    }
  };

  return externalTx ? exec(externalTx) : db.transaction(exec);
}

export async function submitChapterAssignment(chapterAssignmentId: number) {
  return db.transaction(async (tx) => {
    try {
      const current = await repo.findById(chapterAssignmentId, tx);
      if (!current) return err(ErrorCode.CHAPTER_ASSIGNMENT_NOT_FOUND);

      let nextStatus: ChapterAssignmentStatus;
      let snapshotUser: number | null;

      switch (current.status) {
        case 'draft':
          nextStatus = 'peer_check';
          snapshotUser = current.assignedUserId;
          break;
        case 'peer_check':
          nextStatus = 'community_review';
          snapshotUser = current.peerCheckerId;
          break;
        case 'community_review':
          nextStatus = 'linguist_check';
          snapshotUser = current.assignedUserId;
          break;
        case 'linguist_check':
          nextStatus = 'theological_check';
          snapshotUser = current.assignedUserId;
          break;
        case 'theological_check':
          nextStatus = 'consultant_check';
          snapshotUser = current.assignedUserId;
          break;
        case 'consultant_check':
          nextStatus = 'complete';
          snapshotUser = current.assignedUserId;
          break;
        default:
          return err(ErrorCode.INVALID_STATUS_TRANSITION);
      }

      const contentResult = await repo.getContent(tx, current);
      if (!contentResult.ok) return contentResult;

      await repo.insertSnapshot(tx, {
        chapterAssignmentId,
        status: current.status,
        assignedUserId: snapshotUser,
        content: contentResult.data,
      });

      return updateChapterAssignment(
        chapterAssignmentId,
        { submittedTime: new Date(), status: nextStatus },
        tx
      );
    } catch (e) {
      logger.error({
        cause: e,
        message: 'Failed to submit chapter assignment',
        context: { chapterAssignmentId },
      });
      return err(ErrorCode.INTERNAL_ERROR);
    }
  });
}

export function deleteChapterAssignment(id: number) {
  return repo.remove(id);
}

function applyAutoTransition(
  current: ChapterAssignmentRecord,
  data: UpdateChapterAssignmentRequestData
): UpdateChapterAssignmentRequestData {
  const hasUserAssignment = data.assignedUserId !== undefined || data.peerCheckerId !== undefined;
  const shouldAutoTransitionToDraft =
    current.status === 'not_started' && hasUserAssignment && !data.status;

  return {
    ...data,
    ...(shouldAutoTransitionToDraft && { status: 'draft' as const }),
  };
}

async function recordStatusChange(
  tx: DbTransaction,
  current: ChapterAssignmentRecord,
  updated: ChapterAssignmentRecord
) {
  if (updated.status !== current.status) {
    await repo.insertStatusHistory(tx, updated.id, updated.status as ChapterAssignmentStatus);
  }
}

async function recordUserAssignmentChanges(
  tx: DbTransaction,
  current: ChapterAssignmentRecord,
  updated: ChapterAssignmentRecord,
  data: UpdateChapterAssignmentRequestData
) {
  if (
    data.assignedUserId !== undefined &&
    data.assignedUserId !== current.assignedUserId &&
    updated.assignedUserId
  ) {
    await repo.insertUserAssignmentHistory(
      tx,
      updated.id,
      updated.assignedUserId,
      'drafter',
      updated.status as ChapterAssignmentStatus
    );
  }

  if (
    data.peerCheckerId !== undefined &&
    data.peerCheckerId !== current.peerCheckerId &&
    updated.peerCheckerId
  ) {
    await repo.insertUserAssignmentHistory(
      tx,
      updated.id,
      updated.peerCheckerId,
      'peer_checker',
      updated.status as ChapterAssignmentStatus
    );
  }
}
