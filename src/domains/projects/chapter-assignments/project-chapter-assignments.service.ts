import type { ChapterAssignmentStatus } from '@/domains/chapter-assignments/chapter-assignments.types';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import {
  chapter_assignment_assigned_user_history,
  chapter_assignment_status_history,
} from '@/db/schema';
import * as chapterAssignmentService from '@/domains/chapter-assignments/chapter-assignments.service';
import { toChapterAssignmentResponse } from '@/domains/chapter-assignments/chapter-assignments.service';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type {
  AssignSelectedItem,
  AssignUserInput,
  ChapterAssignmentProgress,
} from './project-chapter-assignments.types';

import * as repo from './project-chapter-assignments.repository';

export async function getProjectChapterAssignments(projectId: number) {
  const result = await repo.getByProject(projectId);
  if (!result.ok) return result;
  return ok(result.data.map(toChapterAssignmentResponse));
}

export function deleteChapterAssignmentsByProject(projectId: number) {
  return repo.deleteByProject(projectId);
}

export function getChapterAssignmentProgressByProject(projectId: number) {
  return repo.getProgressByProject(projectId);
}

export async function assignAllProjectChapterAssignmentsToUser(
  projectId: number,
  assignmentData: AssignUserInput
) {
  return db.transaction(async (tx) => {
    if (assignmentData.assignedUserId !== undefined) {
      const isValid = await repo.isUserInProjectOrganization(
        assignmentData.assignedUserId,
        projectId,
        tx
      );
      if (!isValid) return err(ErrorCode.USER_NOT_IN_ORGANIZATION);
    }

    if (assignmentData.peerCheckerId !== undefined) {
      const isValid = await repo.isUserInProjectOrganization(
        assignmentData.peerCheckerId,
        projectId,
        tx
      );
      if (!isValid) return err(ErrorCode.USER_NOT_IN_ORGANIZATION);
    }

    const assignmentIds = await repo.getAssignmentIdsByProject(projectId, tx);
    if (assignmentIds.length === 0) return ok([]);

    const updatedAssignments = [];
    for (const id of assignmentIds) {
      const result = await chapterAssignmentService.updateChapterAssignment(id, assignmentData, tx);
      if (!result.ok) return result;
      updatedAssignments.push(result.data);
    }

    return ok(updatedAssignments);
  });
}

export async function assignSelectedChapters(
  projectId: number,
  assignments: AssignSelectedItem[]
): Promise<Result<ChapterAssignmentProgress[]>> {
  if (assignments.length === 0) return ok([]);

  if (assignments.length > repo.MAX_CHAPTER_ASSIGNMENTS_PER_REQUEST) {
    return err(ErrorCode.CHAPTER_LIMIT_EXCEEDED);
  }

  try {
    return await db.transaction(async (tx) => {
      const chapterAssignmentIds = assignments.map((a) => a.chapterAssignmentId);
      const invalidAssignmentIds = await repo.findAssignmentIdsNotInProject(
        projectId,
        chapterAssignmentIds,
        tx
      );
      if (invalidAssignmentIds.length > 0) {
        return err(ErrorCode.NOT_FOUND, {
          message: `Chapter assignments not found in project: ${invalidAssignmentIds.join(', ')}`,
        });
      }

      const allUserIds = [
        ...new Set(
          assignments.flatMap((a) =>
            [a.drafterId, a.peerCheckerId].filter((id): id is number => id !== null)
          )
        ),
      ];
      if (allUserIds.length > 0) {
        const invalidUserIds = await repo.findUserIdsNotInProjectOrg(projectId, allUserIds, tx);
        if (invalidUserIds.length > 0) {
          return err(ErrorCode.NOT_FOUND, {
            message: `Users not found in project organization: ${invalidUserIds.join(', ')}`,
          });
        }
      }

      const currentAssignments = await repo.findCurrentAssignments(chapterAssignmentIds, tx);
      const projectUnitIds = [...new Set(currentAssignments.map((a) => a.projectUnitId))];
      if (projectUnitIds.length > 0) {
        const projectIdsToActivate = await repo.findNotAssignedProjectIds(projectUnitIds, tx);
        await repo.activateProjects(projectIdsToActivate, tx);
      }

      const updated = await repo.updateAssignmentsIndividually(assignments, tx);
      const assignedUserHistoryRecords: {
        chapterAssignmentId: number;
        assignedUserId: number;
        role: 'drafter' | 'peer_checker';
        status: ChapterAssignmentStatus;
      }[] = [];

      const statusHistoryRecords: {
        chapterAssignmentId: number;
        status: ChapterAssignmentStatus;
      }[] = [];

      for (const updatedRow of updated) {
        const current = currentAssignments.find((a) => a.id === updatedRow.id);
        if (!current) continue;

        const item = assignments.find((a) => a.chapterAssignmentId === updatedRow.id);
        if (!item) continue;

        if (item.drafterId !== null && current.assignedUserId !== item.drafterId) {
          assignedUserHistoryRecords.push({
            chapterAssignmentId: updatedRow.id,
            assignedUserId: item.drafterId,
            role: 'drafter',
            status: updatedRow.status as ChapterAssignmentStatus,
          });
        }

        if (item.peerCheckerId !== null && current.peerCheckerId !== item.peerCheckerId) {
          assignedUserHistoryRecords.push({
            chapterAssignmentId: updatedRow.id,
            assignedUserId: item.peerCheckerId,
            role: 'peer_checker',
            status: updatedRow.status as ChapterAssignmentStatus,
          });
        }

        if (current.status !== updatedRow.status) {
          statusHistoryRecords.push({
            chapterAssignmentId: updatedRow.id,
            status: updatedRow.status as ChapterAssignmentStatus,
          });
        }
      }

      if (assignedUserHistoryRecords.length > 0) {
        await tx
          .insert(chapter_assignment_assigned_user_history)
          .values(assignedUserHistoryRecords);
      }

      if (statusHistoryRecords.length > 0) {
        await tx.insert(chapter_assignment_status_history).values(statusHistoryRecords);
      }

      const updatedIds = updated.map((r) => r.id);
      return ok(await repo.findFullAssignmentsByIds(updatedIds, tx));
    });
  } catch (e) {
    logger.error({
      cause: e,
      message: 'Failed to assign selected chapters',
      context: { projectId, assignments },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
