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

export async function getChapterAssignmentsByUserId(
  userId: number
): Promise<Result<UserChapterAssignment[]>> {
  try {
    const rows = await db
      .select({
        assignmentId: chapter_assignments.id,
        projectName: projects.name,
        projectUnitId: chapter_assignments.projectUnitId,
        bibleId: chapter_assignments.bibleId,
        bibleName: bibles.name,
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
      .where(eq(chapter_assignments.assignedUserId, userId))
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

    const assignmentsWithProgress: UserChapterAssignment[] = rows.map((row) => ({
      chapterAssignmentId: row.assignmentId,
      projectName: row.projectName,
      projectUnitId: row.projectUnitId,
      bibleId: row.bibleId,
      bookCode: row.bookCode,
      bibleName: row.bibleName,
      targetLanguage: row.targetLanguage,
      sourceLangCode: row.sourceLangCode ?? '',
      bookId: row.bookId,
      book: row.bookName,
      chapterNumber: row.chapterNumber,
      totalVerses: Number(row.totalVerses),
      completedVerses: Number(row.completedVerses),
      submittedTime: row.submittedTime?.toISOString() || null,
    }));

    return { ok: true, data: assignmentsWithProgress };
  } catch (err) {
    logger.error({
      error: err,
      message: 'Failed to fetch chapter assignments by user ID',
      context: {
        userId,
      },
    });

    return { ok: false, error: { message: 'Failed to fetch chapter assignments by user ID' } };
  }
}

export async function assignUserToChapters(
  assignedUserId: number,
  chapterAssignmentIds: number[]
): Promise<Result<number[]>> {
  try {
    const updatedAssignmentIds = await db.transaction(async (tx) => {
      const result = await tx
        .update(chapter_assignments)
        .set({ assignedUserId })
        .where(inArray(chapter_assignments.id, chapterAssignmentIds))
        .returning({ id: chapter_assignments.id });

      return result.map(({ id }) => id);
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
