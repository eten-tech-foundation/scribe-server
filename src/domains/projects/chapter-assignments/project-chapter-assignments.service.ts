import type { AssignUserInput } from './project-chapter-assignments.types';

import * as repo from './project-chapter-assignments.repository';

export function getProjectChapterAssignments(projectId: number) {
  return repo.getByProject(projectId);
}

export function deleteChapterAssignmentsByProject(projectId: number) {
  return repo.deleteByProject(projectId);
}

export function getChapterAssignmentProgressByProject(projectId: number) {
  return repo.getProgressByProject(projectId);
}

export function assignAllProjectChapterAssignmentsToUser(
  projectId: number,
  assignmentData: AssignUserInput
) {
  return repo.assignAllToUser(projectId, assignmentData.assignedUserId);
}
