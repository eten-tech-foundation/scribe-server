import { and, eq, inArray } from 'drizzle-orm';

import type { DbTransaction, Result } from '@/lib/types';

import { db } from '@/db';
import { bible_texts, chapter_assignments } from '@/db/schema';
import { logger } from '@/lib/logger';

export interface ChapterAssignmentRecord {
  id: number;
  projectUnitId: number;
  bibleId: number;
  bookId: number;
  chapterNumber: number;
  assignedUserId: number | null;
  peerCheckerId: number | null;
  status: 'not_started' | 'draft' | 'peer_check' | 'community_review';
  submittedTime: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateChapterAssignmentRequestData {
  projectUnitId: number;
  bibleId: number;
  bookId: number;
  chapterNumber: number;
  assignedUserId?: number;
  peerCheckerId?: number;
}

// -------------------------------
// --- START STANDARD HANDLERS ---
// -------------------------------
export async function createChapterAssignment(
  chapterAssignment: CreateChapterAssignmentRequestData
): Promise<Result<ChapterAssignmentRecord>> {
  try {
    const [assignment] = await db.insert(chapter_assignments).values(chapterAssignment).returning();
    return { ok: true, data: assignment };
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to create chapter assignment',
      context: {
        chapterAssignmentRequest: chapterAssignment,
      },
    });
    return { ok: false, error: { message: 'Failed to create chapter assignment' } };
  }
}

export interface updateChapterAssignmentRequestData {
  assignedUserId?: number;
  peerCheckerId?: number;
  status?: 'draft' | 'peer_check' | 'community_review';
  submittedTime?: Date;
}

export async function updateChapterAssignment(
  chapterAssignmentId: number,
  updateData: updateChapterAssignmentRequestData
): Promise<Result<ChapterAssignmentRecord>> {
  try {
    const [currentAssignment] = await db
      .select()
      .from(chapter_assignments)
      .where(eq(chapter_assignments.id, chapterAssignmentId))
      .limit(1);

    if (!currentAssignment) {
      return { ok: false, error: { message: 'Chapter assignment not found' } };
    }

    const dataToUpdate = {
      ...updateData,
      ...(currentAssignment.status === 'not_started' && { status: 'draft' as const }),
    };

    const [assignment] = await db
      .update(chapter_assignments)
      .set(dataToUpdate)
      .where(eq(chapter_assignments.id, chapterAssignmentId))
      .returning();
    if (!assignment) {
      return { ok: false, error: { message: 'Chapter assignment not found' } };
    }
    return { ok: true, data: assignment };
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to update chapter assignment',
      context: {
        updateRequestData: updateData,
      },
    });
    return { ok: false, error: { message: 'Failed to update chapter assignment' } };
  }
}
export async function submitChapterAssignment(
  chapterAssignmentId: number,
  status: 'peer_check' | 'community_review'
): Promise<Result<ChapterAssignmentRecord>> {
  try {
    return await updateChapterAssignment(chapterAssignmentId, {
      submittedTime: new Date(),
      status,
    });
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to submit chapter assignment',
      context: {
        chapterAssignmentId,
        submittedTime: 'auto-generated',
      },
    });
    return { ok: false, error: { message: 'Failed to submit chapter assignment' } };
  }
}
export async function getChapterAssignment(id: number): Promise<Result<ChapterAssignmentRecord>> {
  try {
    const [assignment] = await db
      .select()
      .from(chapter_assignments)
      .where(eq(chapter_assignments.id, id))
      .limit(1);

    if (!assignment) {
      return { ok: false, error: { message: 'Chapter assignment not found' } };
    }

    return { ok: true, data: assignment };
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to fetch chapter assignment',
      context: {
        chapterAssignmentId: id,
      },
    });
    return { ok: false, error: { message: 'Failed to fetch chapter assignment' } };
  }
}

export async function deleteChapterAssignment(id: number): Promise<Result<boolean>> {
  try {
    const [assignment] = await db
      .delete(chapter_assignments)
      .where(eq(chapter_assignments.id, id))
      .returning({ id: chapter_assignments.id });

    return assignment
      ? { ok: true, data: true }
      : { ok: false, error: { message: 'Chapter assignment not found' } };
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to delete chapter assignment',
      context: {
        chapterAssignmentId: id,
      },
    });
    return { ok: false, error: { message: 'Failed to delete chapter assignment' } };
  }
}
// -----------------------------
// --- End STANDARD HANDLERS ---
// -----------------------------

// -----------------------------------
// --- START NON-STANDARD HANDLERS ---
// -----------------------------------
export async function createChapterAssignmentForProjectUnit(
  projectUnitId: number,
  bibleId: number,
  bookIds: number[],
  tx: DbTransaction
): Promise<Result<ChapterAssignmentRecord[]>> {
  try {
    const chapters_list = await tx
      .select({
        bibleId: bible_texts.bibleId,
        bookId: bible_texts.bookId,
        chapterNumber: bible_texts.chapterNumber,
      })
      .from(bible_texts)
      .where(and(eq(bible_texts.bibleId, bibleId), inArray(bible_texts.bookId, bookIds)))
      .groupBy(bible_texts.bibleId, bible_texts.bookId, bible_texts.chapterNumber)
      .orderBy(bible_texts.bookId, bible_texts.chapterNumber);

    if (chapters_list.length === 0) {
      return { ok: true, data: [] };
    }

    const assignments = chapters_list.map((chapter: any) => ({
      projectUnitId,
      bibleId: chapter.bibleId,
      bookId: chapter.bookId,
      chapterNumber: chapter.chapterNumber,
      assignedUserId: null,
      peerCheckerId: null,
    }));

    const chunkSize = 1000;
    const insertedAssignments = [];

    for (let i = 0; i < assignments.length; i += chunkSize) {
      const chunk = assignments.slice(i, i + chunkSize);
      const result = await tx.insert(chapter_assignments).values(chunk).returning();
      insertedAssignments.push(...result);
    }

    return { ok: true, data: insertedAssignments };
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to create chapter assignments for project unit',
      context: {
        projectUnitId,
        bibleId,
        bookIds,
      },
    });
    return {
      ok: false,
      error: { message: 'Failed to create chapter assignments for project unit' },
    };
  }
}
// ---------------------------------
// --- END NON-STANDARD HANDLERS ---
// ---------------------------------
