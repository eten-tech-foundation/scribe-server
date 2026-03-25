import { toChapterAssignmentResponse } from '@/domains/chapter-assignments/chapter-assignments.service';
import { ok } from '@/lib/types';

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
  const result = await repo.assignAllToUser(projectId, assignmentData.assignedUserId);
  if (!result.ok) return result;

  return ok(result.data.map(toChapterAssignmentResponse));
}
