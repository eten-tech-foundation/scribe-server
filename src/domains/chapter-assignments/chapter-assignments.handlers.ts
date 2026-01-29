import { and, eq, inArray } from 'drizzle-orm';

import type { DbTransaction, Result } from '@/lib/types';

import { db } from '@/db';
import {
  bible_texts,
  books,
  chapter_assignment_assigned_user_history,
  chapter_assignment_snapshots,
  chapter_assignment_status_history,
  chapter_assignments,
  translated_verses,
} from '@/db/schema';
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

export interface updateChapterAssignmentRequestData {
  assignedUserId?: number;
  peerCheckerId?: number;
  status?: 'draft' | 'peer_check' | 'community_review';
  submittedTime?: Date;
}

interface VerseContent {
  verseNumber: string;
  verseText: string;
  contents: string[];
}

interface ChapterContent {
  chapterNumber: string;
  contents: Array<{ p: null } | VerseContent>;
}

interface SnapshotContent {
  book: {
    bookCode: string;
    meta: Array<{ h: string } | Array<{ mt: string[] }>>;
  };
  chapters: ChapterContent[];
  _messages?: {
    _warnings?: string[];
  };
}

async function getAssignmentContent(
  tx: DbTransaction,
  assignment: ChapterAssignmentRecord
): Promise<SnapshotContent> {
  const verses = await tx
    .select({
      id: translated_verses.id,
      content: translated_verses.content,
      verseNumber: bible_texts.verseNumber,
      bibleTextId: bible_texts.id,
      bookCode: books.code,
      bookName: books.eng_display_name,
    })
    .from(translated_verses)
    .innerJoin(bible_texts, eq(translated_verses.bibleTextId, bible_texts.id))
    .innerJoin(books, eq(bible_texts.bookId, books.id))
    .where(
      and(
        eq(translated_verses.projectUnitId, assignment.projectUnitId),
        eq(bible_texts.chapterNumber, assignment.chapterNumber),
        eq(bible_texts.bookId, assignment.bookId),
        eq(bible_texts.bibleId, assignment.bibleId)
      )
    )
    .orderBy(bible_texts.verseNumber);

  const bookCode = verses[0]?.bookCode || 'UNKNOWN';
  const bookName = verses[0]?.bookName || 'Unknown Book';

  const verseContents: any[] = [{ p: null }];

  for (const v of verses) {
    const verse = Object.assign(
      {},
      { verseNumber: v.verseNumber.toString() },
      { verseText: v.content },
      { contents: [v.content] }
    );
    verseContents.push(verse);
  }

  const chapter = Object.assign(
    {},
    { chapterNumber: assignment.chapterNumber.toString() },
    { contents: verseContents }
  );

  const book = Object.assign({}, { bookCode }, { meta: [{ h: bookName }, [{ mt: [bookName] }]] });

  const snapshotContent = Object.assign(
    {},
    { book },
    { chapters: [chapter] },
    {
      _messages: {
        _warnings: verses.length === 0 ? ['No translated verses found for this chapter.'] : [],
      },
    }
  );

  return snapshotContent as SnapshotContent;
}

export async function createChapterAssignment(
  chapterAssignment: CreateChapterAssignmentRequestData
): Promise<Result<ChapterAssignmentRecord>> {
  return await db.transaction(async (tx) => {
    try {
      const [assignment] = await tx
        .insert(chapter_assignments)
        .values(chapterAssignment)
        .returning();

      await tx.insert(chapter_assignment_status_history).values({
        chapterAssignmentId: assignment.id,
        status: 'not_started',
      });

      if (assignment.assignedUserId) {
        await tx.insert(chapter_assignment_assigned_user_history).values({
          chapterAssignmentId: assignment.id,
          assignedUserId: assignment.assignedUserId,
          status: 'not_started',
        });
      }

      if (assignment.peerCheckerId) {
        await tx.insert(chapter_assignment_assigned_user_history).values({
          chapterAssignmentId: assignment.id,
          assignedUserId: assignment.peerCheckerId,
          status: 'not_started',
        });
      }

      return { ok: true, data: assignment };
    } catch (err) {
      logger.error({
        cause: err,
        message: 'Failed to create chapter assignment',
        context: { chapterAssignmentRequest: chapterAssignment },
      });
      return { ok: false, error: { message: 'Failed to create chapter assignment' } };
    }
  });
}

export async function updateChapterAssignment(
  chapterAssignmentId: number,
  updateData: updateChapterAssignmentRequestData,
  externalTx?: DbTransaction
): Promise<Result<ChapterAssignmentRecord>> {
  const executeUpdate = async (tx: DbTransaction): Promise<Result<ChapterAssignmentRecord>> => {
    try {
      const [currentAssignment] = await tx
        .select()
        .from(chapter_assignments)
        .where(eq(chapter_assignments.id, chapterAssignmentId))
        .limit(1);

      if (!currentAssignment) {
        throw new Error('Chapter assignment not found');
      }

      const hasUserAssignment =
        updateData.assignedUserId !== undefined || updateData.peerCheckerId !== undefined;
      const shouldAutoTransitionToDraft =
        currentAssignment.status === 'not_started' && hasUserAssignment && !updateData.status;

      const finalUpdateData = {
        ...updateData,
        ...(shouldAutoTransitionToDraft && { status: 'draft' as const }),
      };

      const [updatedAssignment] = await tx
        .update(chapter_assignments)
        .set(finalUpdateData)
        .where(eq(chapter_assignments.id, chapterAssignmentId))
        .returning();

      if (updatedAssignment.status !== currentAssignment.status) {
        await tx.insert(chapter_assignment_status_history).values({
          chapterAssignmentId: updatedAssignment.id,
          status: updatedAssignment.status,
        });
      }

      if (
        updateData.assignedUserId !== undefined &&
        updateData.assignedUserId !== currentAssignment.assignedUserId &&
        updatedAssignment.assignedUserId
      ) {
        await tx.insert(chapter_assignment_assigned_user_history).values({
          chapterAssignmentId: updatedAssignment.id,
          assignedUserId: updatedAssignment.assignedUserId,
          status: updatedAssignment.status,
        });
      }

      if (
        updateData.peerCheckerId !== undefined &&
        updateData.peerCheckerId !== currentAssignment.peerCheckerId &&
        updatedAssignment.peerCheckerId
      ) {
        await tx.insert(chapter_assignment_assigned_user_history).values({
          chapterAssignmentId: updatedAssignment.id,
          assignedUserId: updatedAssignment.peerCheckerId,
          status: updatedAssignment.status,
        });
      }

      return { ok: true, data: updatedAssignment };
    } catch (err: any) {
      if (err.message === 'Chapter assignment not found') {
        return { ok: false, error: { message: err.message } };
      }
      throw err;
    }
  };

  try {
    if (externalTx) {
      return await executeUpdate(externalTx);
    } else {
      return await db.transaction(async (tx) => executeUpdate(tx));
    }
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to update chapter assignment',
      context: { updateRequestData: updateData },
    });
    return { ok: false, error: { message: 'Failed to update chapter assignment' } };
  }
}

export async function submitChapterAssignment(
  chapterAssignmentId: number
): Promise<Result<ChapterAssignmentRecord>> {
  return await db.transaction(async (tx) => {
    try {
      const [currentAssignment] = await tx
        .select()
        .from(chapter_assignments)
        .where(eq(chapter_assignments.id, chapterAssignmentId))
        .limit(1);

      if (!currentAssignment) {
        return { ok: false, error: { message: 'Chapter assignment not found' } };
      }

      let nextStatus: 'peer_check' | 'community_review';
      let snapshotUser: number | null = null;

      if (currentAssignment.status === 'draft') {
        nextStatus = 'peer_check';
        snapshotUser = currentAssignment.assignedUserId;
      } else if (currentAssignment.status === 'peer_check') {
        nextStatus = 'community_review';
        snapshotUser = currentAssignment.peerCheckerId;
      } else {
        return {
          ok: false,
          error: {
            message: `Cannot submit assignment with status '${currentAssignment.status}'. Must be 'draft' or 'peer_check'.`,
          },
        };
      }

      const content = await getAssignmentContent(tx, currentAssignment);

      await tx.insert(chapter_assignment_snapshots).values({
        chapterAssignmentId,
        status: currentAssignment.status,
        assignedUserId: snapshotUser,
        content: content as any,
      });

      const updateResult = await updateChapterAssignment(
        chapterAssignmentId,
        {
          submittedTime: new Date(),
          status: nextStatus,
        },
        tx
      );

      return updateResult;
    } catch (err) {
      logger.error({
        cause: err,
        message: 'Failed to submit chapter assignment',
        context: { chapterAssignmentId },
      });
      return { ok: false, error: { message: 'Failed to submit chapter assignment' } };
    }
  });
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
      context: { chapterAssignmentId: id },
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
      context: { chapterAssignmentId: id },
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
      context: { projectUnitId, bibleId, bookIds },
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
