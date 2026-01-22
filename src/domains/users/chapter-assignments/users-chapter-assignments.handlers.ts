import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import {
  bible_texts,
  bibles,
  books,
  chapter_assignments,
  languages,
  project_units,
  projects,
  translated_verses,
} from '@/db/schema';
import { logger } from '@/lib/logger';

export interface UserChapterAssignment {
  chapterAssignmentId: number;
  projectName: string;
  projectUnitId: number;
  bibleId: number;
  bibleName: string;
  chapterStatus: string;
  targetLanguage: string;
  sourceLangCode: string;
  bookCode: string;
  bookId: number;
  book: string;
  chapterNumber: number;
  totalVerses: number;
  completedVerses: number;
  submittedTime: string | null;
}

const sourceLang = alias(languages, 'source_lang');

function createChapterAssignmentsBaseQuery() {
  return db
    .select({
      assignmentId: chapter_assignments.id,
      projectName: projects.name,
      projectUnitId: chapter_assignments.projectUnitId,
      bibleId: chapter_assignments.bibleId,
      bibleName: bibles.name,
      chapterStatus: chapter_assignments.status,
      targetLanguage: languages.langName,
      bookId: chapter_assignments.bookId,
      bookName: books.eng_display_name,
      bookCode: books.code,
      sourceLangCode: sourceLang.langCodeIso6393,
      chapterNumber: chapter_assignments.chapterNumber,
      submittedTime: chapter_assignments.submittedTime,
      totalVerses: sql<number>`COUNT(${bible_texts.id})`,
      completedVerses: sql<number>`COUNT(CASE WHEN ${translated_verses.content} != '' AND ${translated_verses.content} IS NOT NULL THEN 1 END)`,
    })
    .from(chapter_assignments)
    .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
    .innerJoin(projects, eq(project_units.projectId, projects.id))
    .innerJoin(bibles, eq(chapter_assignments.bibleId, bibles.id))
    .innerJoin(languages, eq(projects.targetLanguage, languages.id))
    .innerJoin(sourceLang, eq(projects.sourceLanguage, sourceLang.id))
    .innerJoin(books, eq(chapter_assignments.bookId, books.id))
    .innerJoin(
      bible_texts,
      and(
        eq(bible_texts.bibleId, chapter_assignments.bibleId),
        eq(bible_texts.bookId, chapter_assignments.bookId),
        eq(bible_texts.chapterNumber, chapter_assignments.chapterNumber)
      )
    )
    .leftJoin(
      translated_verses,
      and(
        eq(translated_verses.bibleTextId, bible_texts.id),
        eq(translated_verses.projectUnitId, chapter_assignments.projectUnitId)
      )
    )
    .groupBy(
      chapter_assignments.id,
      chapter_assignments.projectUnitId,
      chapter_assignments.bibleId,
      chapter_assignments.bookId,
      chapter_assignments.chapterNumber,
      chapter_assignments.submittedTime,
      projects.name,
      bibles.name,
      languages.langName,
      sourceLang.langCodeIso6393,
      books.eng_display_name,
      books.code
    )
    .orderBy(projects.name, books.eng_display_name, chapter_assignments.chapterNumber);
}

function mapRowsToAssignments(rows: any[]): UserChapterAssignment[] {
  return rows.map((row) => ({
    chapterAssignmentId: row.assignmentId,
    projectName: row.projectName,
    projectUnitId: row.projectUnitId,
    bibleId: row.bibleId,
    bookCode: row.bookCode,
    bibleName: row.bibleName,
    chapterStatus: row.chapterStatus,
    targetLanguage: row.targetLanguage,
    sourceLangCode: row.sourceLangCode ?? '',
    bookId: row.bookId,
    book: row.bookName,
    chapterNumber: row.chapterNumber,
    totalVerses: Number(row.totalVerses),
    completedVerses: Number(row.completedVerses),
    submittedTime: row.submittedTime?.toISOString() || null,
  }));
}

export async function getAssignedChaptersByUserId(
  userId: number
): Promise<Result<UserChapterAssignment[]>> {
  try {
    const rows = await createChapterAssignmentsBaseQuery().where(
      eq(chapter_assignments.assignedUserId, userId)
    );

    return { ok: true, data: mapRowsToAssignments(rows) };
  } catch (err) {
    logger.error({
      error: err,
      message: 'Failed to fetch assigned chapters by user ID',
      context: { userId },
    });
    return {
      ok: false,
      error: { message: 'Failed to fetch assigned chapters by user ID' },
    };
  }
}

export async function getPeerCheckChaptersByUserId(
  userId: number
): Promise<Result<UserChapterAssignment[]>> {
  try {
    const rows = await createChapterAssignmentsBaseQuery().where(
      and(
        eq(chapter_assignments.peerCheckerId, userId),
        eq(chapter_assignments.status, 'peer_check')
      )
    );

    return { ok: true, data: mapRowsToAssignments(rows) };
  } catch (err) {
    logger.error({
      error: err,
      message: 'Failed to fetch peer check chapters by user ID',
      context: { userId },
    });
    return {
      ok: false,
      error: { message: 'Failed to fetch peer check chapters by user ID' },
    };
  }
}

export async function getAllChapterAssignmentsByUserId(userId: number): Promise<
  Result<{
    assignedChapters: UserChapterAssignment[];
    peerCheckChapters: UserChapterAssignment[];
  }>
> {
  try {
    const [assignedResult, peerCheckResult] = await Promise.all([
      getAssignedChaptersByUserId(userId),
      getPeerCheckChaptersByUserId(userId),
    ]);

    if (!assignedResult.ok) {
      return assignedResult as Result<any>;
    }
    if (!peerCheckResult.ok) {
      return peerCheckResult as Result<any>;
    }

    return {
      ok: true,
      data: {
        assignedChapters: assignedResult.data,
        peerCheckChapters: peerCheckResult.data,
      },
    };
  } catch (err) {
    logger.error({
      error: err,
      message: 'Failed to fetch all chapter assignments by user ID',
      context: { userId },
    });
    return {
      ok: false,
      error: { message: 'Failed to fetch all chapter assignments by user ID' },
    };
  }
}

export async function getChapterAssignmentsByUserId(
  userId: number
): Promise<Result<UserChapterAssignment[]>> {
  const result = await getAllChapterAssignmentsByUserId(userId);

  if (!result.ok) {
    return result as Result<UserChapterAssignment[]>;
  }

  return {
    ok: true,
    data: [...result.data.assignedChapters, ...result.data.peerCheckChapters],
  };
}
export async function assignUserToChapters(
  assignedUserId: number,
  chapterAssignmentIds: number[],
  peerCheckerId: number
): Promise<Result<number[]>> {
  try {
    const updatedAssignmentIds = await db.transaction(async (tx) => {
      const currentAssignments = await tx
        .select({
          id: chapter_assignments.id,
          status: chapter_assignments.status,
        })
        .from(chapter_assignments)
        .where(inArray(chapter_assignments.id, chapterAssignmentIds));

      const statusUpdates = new Map(
        currentAssignments.map((a) => [a.id, a.status === 'not_started'])
      );

      const results = await Promise.all(
        chapterAssignmentIds.map(async (id) => {
          const dataToUpdate = {
            assignedUserId,
            peerCheckerId,
            ...(statusUpdates.get(id) && { status: 'draft' as const }),
          };

          const [updated] = await tx
            .update(chapter_assignments)
            .set(dataToUpdate)
            .where(eq(chapter_assignments.id, id))
            .returning({ id: chapter_assignments.id });

          return updated.id;
        })
      );

      return results;
    });

    return { ok: true, data: updatedAssignmentIds };
  } catch (err) {
    logger.error(
      {
        error: err,
        message: 'Failed to assign users to chapters',
        context: {
          assignedUserId,
          chapterAssignmentIds,
          peerCheckerId,
        },
      },
      'Failed to assign users to chapters'
    );

    return {
      ok: false,
      error: { message: 'Failed to assign users to chapters' },
    };
  }
}
