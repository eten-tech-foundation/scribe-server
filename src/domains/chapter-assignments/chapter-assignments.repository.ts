import { and, eq, inArray } from 'drizzle-orm';

import type { DbTransaction, Result, USJDocument } from '@/lib/types';
import type { VerseData } from '@/lib/usfm-converter';

import { db } from '@/db';
import {
  bible_texts,
  books,
  chapter_assignment_assigned_user_history,
  chapter_assignment_snapshots,
  chapter_assignment_status_history,
  chapter_assignments,
  project_units,
  projects,
  translated_verses,
} from '@/db/schema';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';
import { convertUSFMToUSJ, generateUSFMText } from '@/lib/usfm-converter';

import type { PolicyChapterAssignment } from './chapter-assignments.policy';
import type {
  ChapterAssignmentRecord,
  ChapterAssignmentRecordWithOrg,
  ChapterAssignmentStatus,
  CreateChapterAssignmentRequestData,
  UpdateChapterAssignmentRequestData,
} from './chapter-assignments.types';

const USJ_SPEC_VERSION = '0.0.1';

export async function findById(
  id: number,
  tx?: DbTransaction
): Promise<ChapterAssignmentRecord | null> {
  const conn = tx ?? db;
  const [assignment] = await conn
    .select()
    .from(chapter_assignments)
    .where(eq(chapter_assignments.id, id))
    .limit(1);
  return assignment ?? null;
}

export async function findByIdWithOrg(id: number): Promise<Result<ChapterAssignmentRecordWithOrg>> {
  try {
    const [assignment] = await db
      .select({
        id: chapter_assignments.id,
        projectUnitId: chapter_assignments.projectUnitId,
        bibleId: chapter_assignments.bibleId,
        bookId: chapter_assignments.bookId,
        chapterNumber: chapter_assignments.chapterNumber,
        assignedUserId: chapter_assignments.assignedUserId,
        peerCheckerId: chapter_assignments.peerCheckerId,
        status: chapter_assignments.status,
        submittedTime: chapter_assignments.submittedTime,
        createdAt: chapter_assignments.createdAt,
        updatedAt: chapter_assignments.updatedAt,
        organizationId: projects.organization,
      })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .innerJoin(projects, eq(project_units.projectId, projects.id))
      .where(eq(chapter_assignments.id, id))
      .limit(1);

    if (!assignment) return err(ErrorCode.CHAPTER_ASSIGNMENT_NOT_FOUND);
    return ok(assignment);
  } catch (e) {
    logger.error({ cause: e, message: 'Failed to fetch chapter assignment', context: { id } });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function findForVerse(
  projectUnitId: number,
  bibleTextId: number
): Promise<Result<PolicyChapterAssignment>> {
  try {
    const [bibleText] = await db
      .select({ bookId: bible_texts.bookId, chapterNumber: bible_texts.chapterNumber })
      .from(bible_texts)
      .where(eq(bible_texts.id, bibleTextId))
      .limit(1);

    if (!bibleText) return err(ErrorCode.INVALID_REFERENCE);

    const [assignment] = await db
      .select({
        assignedUserId: chapter_assignments.assignedUserId,
        peerCheckerId: chapter_assignments.peerCheckerId,
        status: chapter_assignments.status,
        organizationId: projects.organization,
      })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .innerJoin(projects, eq(project_units.projectId, projects.id))
      .where(
        and(
          eq(chapter_assignments.projectUnitId, projectUnitId),
          eq(chapter_assignments.bookId, bibleText.bookId),
          eq(chapter_assignments.chapterNumber, bibleText.chapterNumber)
        )
      )
      .limit(1);

    if (!assignment) return err(ErrorCode.CHAPTER_ASSIGNMENT_NOT_FOUND);
    return ok(assignment);
  } catch (e) {
    logger.error({
      cause: e,
      message: 'Failed to resolve chapter assignment for verse',
      context: { projectUnitId, bibleTextId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function findChaptersForProjectUnit(
  bibleId: number,
  bookIds: number[],
  tx: DbTransaction
) {
  return tx
    .select({
      bibleId: bible_texts.bibleId,
      bookId: bible_texts.bookId,
      chapterNumber: bible_texts.chapterNumber,
    })
    .from(bible_texts)
    .where(and(eq(bible_texts.bibleId, bibleId), inArray(bible_texts.bookId, bookIds)))
    .groupBy(bible_texts.bibleId, bible_texts.bookId, bible_texts.chapterNumber)
    .orderBy(bible_texts.bookId, bible_texts.chapterNumber);
}

export async function getContent(
  tx: DbTransaction,
  assignment: ChapterAssignmentRecord
): Promise<Result<USJDocument>> {
  try {
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

    if (verses.length === 0) {
      logger.warn('No translated verses found for assignment', {
        assignmentId: assignment.id,
        chapterNumber: assignment.chapterNumber,
      });
      return ok({ type: 'USJ', version: USJ_SPEC_VERSION, content: [] });
    }

    const verseData: VerseData[] = verses.map((v) => ({
      bookId: assignment.bookId,
      bookCode: v.bookCode,
      bookName: v.bookName,
      chapterNumber: assignment.chapterNumber,
      verseNumber: v.verseNumber,
      translatedContent: v.content,
    }));

    const conversionResult = convertUSFMToUSJ(generateUSFMText(verseData));
    if (!conversionResult.ok) {
      logger.error('Failed to convert USFM to USJ', {
        assignmentId: assignment.id,
        error: conversionResult.error,
      });
      return conversionResult;
    }

    return ok(conversionResult.data);
  } catch (e) {
    logger.error({
      cause: e,
      message: 'Failed to generate assignment content',
      context: { assignmentId: assignment.id },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function insert(
  data: CreateChapterAssignmentRequestData,
  tx: DbTransaction
): Promise<ChapterAssignmentRecord> {
  const [assignment] = await tx.insert(chapter_assignments).values(data).returning();
  return assignment;
}

export async function insertMany(
  records: Array<{
    projectUnitId: number;
    bibleId: number;
    bookId: number;
    chapterNumber: number;
    assignedUserId: null;
    peerCheckerId: null;
  }>,
  tx: DbTransaction
): Promise<ChapterAssignmentRecord[]> {
  const chunkSize = 1000;
  const inserted: ChapterAssignmentRecord[] = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const result = await tx.insert(chapter_assignments).values(chunk).returning();
    inserted.push(...result);
  }
  return inserted;
}

export async function update(
  id: number,
  data: UpdateChapterAssignmentRequestData,
  tx: DbTransaction
): Promise<ChapterAssignmentRecord | null> {
  const [updated] = await tx
    .update(chapter_assignments)
    .set(data)
    .where(eq(chapter_assignments.id, id))
    .returning();
  return updated ?? null;
}

export async function remove(id: number): Promise<Result<void>> {
  try {
    const [deleted] = await db
      .delete(chapter_assignments)
      .where(eq(chapter_assignments.id, id))
      .returning({ id: chapter_assignments.id });
    if (!deleted) return err(ErrorCode.CHAPTER_ASSIGNMENT_NOT_FOUND);
    return ok(undefined);
  } catch (e) {
    logger.error({ cause: e, message: 'Failed to delete chapter assignment', context: { id } });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function insertStatusHistory(
  tx: DbTransaction,
  chapterAssignmentId: number,
  status: ChapterAssignmentStatus
): Promise<void> {
  await tx.insert(chapter_assignment_status_history).values({ chapterAssignmentId, status });
}

export async function insertUserAssignmentHistory(
  tx: DbTransaction,
  chapterAssignmentId: number,
  assignedUserId: number,
  role: 'drafter' | 'peer_checker',
  status: ChapterAssignmentStatus
): Promise<void> {
  await tx
    .insert(chapter_assignment_assigned_user_history)
    .values({ chapterAssignmentId, assignedUserId, role, status });
}

export async function insertSnapshot(
  tx: DbTransaction,
  data: {
    chapterAssignmentId: number;
    status: ChapterAssignmentStatus;
    assignedUserId: number | null;
    content: USJDocument;
  }
): Promise<void> {
  await tx.insert(chapter_assignment_snapshots).values(data);
}
