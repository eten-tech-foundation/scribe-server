import type { Result } from '@/lib/types';

import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type {
  UserChapterAssignment,
  UserChapterAssignmentResponse,
  UserChapterAssignmentsByUserResponse,
} from './users-chapter-assignments.types';

import * as repo from './users-chapter-assignments.repository';

export function toResponse(assignment: UserChapterAssignment): UserChapterAssignmentResponse {
  return {
    chapterAssignmentId: assignment.chapterAssignmentId,
    projectId: assignment.projectId,
    projectName: assignment.projectName,
    projectUnitId: assignment.projectUnitId,
    bibleId: assignment.bibleId,
    bibleName: assignment.bibleName,
    chapterStatus: assignment.chapterStatus,
    targetLanguage: assignment.targetLanguage,
    sourceLangCode: assignment.sourceLangCode,
    bookCode: assignment.bookCode,
    bookId: assignment.bookId,
    book: assignment.book,
    chapterNumber: assignment.chapterNumber,
    totalVerses: assignment.totalVerses,
    completedVerses: assignment.completedVerses,
    submittedTime: assignment.submittedTime,
    assignedUserId: assignment.assignedUserId,
    peerCheckerId: assignment.peerCheckerId,
    updatedAt: assignment.updatedAt,
  };
}

export async function getAssignedChaptersByUserId(
  userId: number
): Promise<Result<UserChapterAssignmentResponse[]>> {
  const result = await repo.findAssignedByUserId(userId);
  if (!result.ok) return result;
  return ok(result.data.map(toResponse));
}

export async function getPeerCheckChaptersByUserId(
  userId: number
): Promise<Result<UserChapterAssignmentResponse[]>> {
  const result = await repo.findPeerCheckByUserId(userId);
  if (!result.ok) return result;
  return ok(result.data.map(toResponse));
}

export async function getAllChapterAssignmentsByUserId(
  userId: number
): Promise<Result<UserChapterAssignmentsByUserResponse>> {
  try {
    const [assignedResult, peerCheckResult] = await Promise.all([
      getAssignedChaptersByUserId(userId),
      getPeerCheckChaptersByUserId(userId),
    ]);

    if (!assignedResult.ok) return assignedResult;
    if (!peerCheckResult.ok) return peerCheckResult;

    return ok({
      assignedChapters: assignedResult.data,
      peerCheckChapters: peerCheckResult.data,
    });
  } catch (e) {
    logger.error({
      cause: e,
      message: 'Failed to fetch all chapter assignments by user ID',
      context: { userId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
