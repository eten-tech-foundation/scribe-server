import type { Result } from '@/lib/types';

import { db } from '@/db';
import * as chapterAssignmentService from '@/domains/chapter-assignments/chapter-assignments.service';
import { toChapterAssignmentResponse } from '@/domains/chapter-assignments/chapter-assignments.service';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type {
  AssignSelectedItem,
  AssignUserInput,
  ChapterAssignmentProgress,
} from './project-chapter-assignments.types';

import * as projectRepo from '../projects.repository';
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
      const invalidAssignmentIds = await projectRepo.findAssignmentIdsNotInProject(
        projectId,
        chapterAssignmentIds,
        tx
      );
      if (invalidAssignmentIds.length > 0) {
        return err(ErrorCode.NOT_FOUND);
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
          return err(ErrorCode.NOT_FOUND);
        }
      }

      const projectUnitIds = await repo.findProjectUnitIdsByAssignmentIds(chapterAssignmentIds, tx);
      if (projectUnitIds.length > 0) {
        const projectIdsToActivate = await repo.findNotAssignedProjectIds(projectUnitIds, tx);
        await repo.activateProjects(projectIdsToActivate, tx);
      }

      const updatedIds: number[] = [];
      for (const item of assignments) {
        const result = await chapterAssignmentService.updateChapterAssignment(
          item.chapterAssignmentId,
          { assignedUserId: item.drafterId, peerCheckerId: item.peerCheckerId },
          tx
        );
        if (!result.ok) return result;
        updatedIds.push(item.chapterAssignmentId);
      }

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
