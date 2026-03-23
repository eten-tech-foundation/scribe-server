import type { ChapterAssignmentRecord } from '@/domains/chapter-assignments/chapter-assignments.handlers';
import type { Result } from '@/lib/types';

import type { ChapterAssignmentProgress } from './project-chapter-assignments.types';

import * as repo from './project-chapter-assignments.repository';

export function getProjectChapterAssignments(
  projectId: number
): Promise<Result<ChapterAssignmentRecord[]>> {
  return repo.getByProject(projectId);
}

export function deleteChapterAssignmentsByProject(
  projectId: number
): Promise<Result<{ deletedCount: number }>> {
  return repo.deleteByProject(projectId);
}

export function getChapterAssignmentProgressByProject(
  projectId: number
): Promise<Result<ChapterAssignmentProgress[]>> {
  return repo.getProgressByProject(projectId);
}

export function assignAllProjectChapterAssignmentsToUser(
  projectId: number,
  assignmentData: { assignedUserId: number }
): Promise<Result<ChapterAssignmentRecord[]>> {
  return repo.assignAllToUser(projectId, assignmentData.assignedUserId);
}
