// format
import { db } from '@/db';
import * as chapterAssignmentService from '@/domains/chapter-assignments/chapter-assignments.service';
import { toChapterAssignmentResponse } from '@/domains/chapter-assignments/chapter-assignments.service';
import { err, ErrorCode, ok } from '@/lib/types';

import type { AssignUserInput } from './project-chapter-assignments.types';

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
    // Validate organization match for assignedUserId (if provided)
    if (assignmentData.assignedUserId !== undefined) {
      const isDrafterValid = await repo.isUserInProjectOrganization(
        assignmentData.assignedUserId,
        projectId,
        tx
      );
      if (!isDrafterValid) return err(ErrorCode.USER_NOT_IN_ORGANIZATION);
    }

    // Validate organization match for peerCheckerId (if provided)
    if (assignmentData.peerCheckerId !== undefined) {
      const isPeerCheckerValid = await repo.isUserInProjectOrganization(
        assignmentData.peerCheckerId,
        projectId,
        tx
      );
      if (!isPeerCheckerValid) return err(ErrorCode.USER_NOT_IN_ORGANIZATION);
    }

    // Retrieve target assignment IDs
    const assignmentIds = await repo.getAssignmentIdsByProject(projectId, tx);

    if (assignmentIds.length === 0) return ok([]);

    const updatedAssignments = [];

    // Delegate updates to central chapter assignments service
    // We pass assignmentData directly, which naturally unpacks into the fields we provided!
    for (const id of assignmentIds) {
      const result = await chapterAssignmentService.updateChapterAssignment(id, assignmentData, tx);

      if (!result.ok) {
        return result;
      }

      updatedAssignments.push(result.data);
    }

    return ok(updatedAssignments);
  });
}
