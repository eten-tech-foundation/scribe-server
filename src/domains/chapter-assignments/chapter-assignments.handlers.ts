import { and, eq, inArray, sql } from 'drizzle-orm';

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
  users,
} from '@/db/schema';

export interface ChapterAssignment {
  id?: number;
  projectUnitId: number;
  bibleId: number;
  bookId: number;
  chapterNumber: number;
  assignedUserId: number | null;
  isSubmitted?: boolean;
  submittedTime?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface ChapterAssignmentProgress {
  book: string;
  chapterNumber: number;
  assignedUser: string;
  projectUnitId: number;
  assignmentId: number;
  totalVerses: number;
  completedVerses: number;
}

export interface ChapterAssignmentByUser {
  projectName: string;
  projectUnitId: number;
  bibleId: number;
  bibleName: string;
  targetLanguage: string;
  bookId: number;
  book: string;
  chapterNumber: number;
  totalVerses: number;
  completedVerses: number;
  isSubmitted: boolean;
  submittedTime: string | null;
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getChapterAssignmentProgressByProject(
  projectId: number
): Promise<Result<ChapterAssignmentProgress[]>> {
  try {
    const rows = await db
      .select({
        assignmentId: chapter_assignments.id,
        projectUnitId: chapter_assignments.projectUnitId,
        bibleId: chapter_assignments.bibleId,
        bookId: chapter_assignments.bookId,
        chapterNumber: chapter_assignments.chapterNumber,
        bookName: books.eng_display_name,
        firstName: users.firstName,
        lastName: users.lastName,
        totalVerses: sql<number>`COUNT(${bible_texts.id})`,
        completedVerses: sql<number>`COUNT(${translated_verses.id})`,
      })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .innerJoin(books, eq(chapter_assignments.bookId, books.id))
      .leftJoin(users, eq(chapter_assignments.assignedUserId, users.id))
      .innerJoin(
        bible_texts,
        and(
          eq(bible_texts.bibleId, chapter_assignments.bibleId),
          eq(bible_texts.bookId, chapter_assignments.bookId),
          eq(bible_texts.chapterNumber, chapter_assignments.chapterNumber)
        )
      )
      .leftJoin(translated_verses, eq(translated_verses.bibleTextId, bible_texts.id))
      .where(eq(project_units.projectId, projectId))
      .groupBy(
        chapter_assignments.id,
        chapter_assignments.projectUnitId,
        chapter_assignments.bibleId,
        chapter_assignments.bookId,
        chapter_assignments.chapterNumber,
        books.eng_display_name,
        users.firstName,
        users.lastName
      )
      .orderBy(books.eng_display_name, chapter_assignments.chapterNumber);

    const progressData: ChapterAssignmentProgress[] = rows.map((row) => {
      const assignedUser = row.firstName && row.lastName ? `${row.firstName} ${row.lastName}` : '';
      return {
        book: row.bookName,
        chapterNumber: row.chapterNumber,
        assignedUser,
        projectUnitId: row.projectUnitId,
        assignmentId: row.assignmentId,
        totalVerses: Number(row.totalVerses),
        completedVerses: Number(row.completedVerses),
      };
    });

    return { ok: true, data: progressData };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch chapter assignment progress' } };
  }
}

export async function getChapterAssignmentsByUserId(
  userId: number
): Promise<Result<ChapterAssignmentByUser[]>> {
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
        chapterNumber: chapter_assignments.chapterNumber,
        isSubmitted: chapter_assignments.isSubmitted,
        submittedTime: chapter_assignments.submittedTime,
        totalVerses: sql<number>`COUNT(${bible_texts.id})`,
        completedVerses: sql<number>`COUNT(${translated_verses.id})`,
      })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .innerJoin(projects, eq(project_units.projectId, projects.id))
      .innerJoin(bibles, eq(chapter_assignments.bibleId, bibles.id))
      .innerJoin(languages, eq(projects.targetLanguage, languages.id))
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
          eq(translated_verses.assignedUserId, userId)
        )
      )
      .where(eq(chapter_assignments.assignedUserId, userId))
      .groupBy(
        chapter_assignments.id,
        chapter_assignments.projectUnitId,
        chapter_assignments.bibleId,
        chapter_assignments.bookId,
        chapter_assignments.chapterNumber,
        chapter_assignments.isSubmitted,
        chapter_assignments.submittedTime,
        projects.name,
        bibles.name,
        languages.langName,
        books.eng_display_name
      )
      .orderBy(projects.name, books.eng_display_name, chapter_assignments.chapterNumber);

    const assignmentsWithProgress: ChapterAssignmentByUser[] = rows.map((row) => ({
      projectName: row.projectName,
      projectUnitId: row.projectUnitId,
      bibleId: row.bibleId,
      bibleName: row.bibleName,
      targetLanguage: row.targetLanguage,
      bookId: row.bookId,
      book: row.bookName,
      chapterNumber: row.chapterNumber,
      totalVerses: Number(row.totalVerses),
      completedVerses: Number(row.completedVerses),
      isSubmitted: row.isSubmitted || false,
      submittedTime: row.submittedTime?.toISOString() || null,
    }));

    return { ok: true, data: assignmentsWithProgress };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch chapter assignments by user ID' } };
  }
}

export async function createChapterAssignments(
  projectUnitId: number,
  bibleId: number,
  bookIds: number[],
  tx: DbTransaction
): Promise<Result<ChapterAssignment[]>> {
  try {
    const chapters = await tx
      .select({
        bibleId: bible_texts.bibleId,
        bookId: bible_texts.bookId,
        chapterNumber: bible_texts.chapterNumber,
      })
      .from(bible_texts)
      .where(and(eq(bible_texts.bibleId, bibleId), inArray(bible_texts.bookId, bookIds)))
      .groupBy(bible_texts.bibleId, bible_texts.bookId, bible_texts.chapterNumber)
      .orderBy(bible_texts.bookId, bible_texts.chapterNumber);

    if (chapters.length === 0) {
      return { ok: true, data: [] };
    }

    const assignments = chapters.map((chapter: any) => ({
      projectUnitId,
      bibleId: chapter.bibleId,
      bookId: chapter.bookId,
      chapterNumber: chapter.chapterNumber,
      assignedUserId: null,
    }));

    const insertedAssignments = await tx
      .insert(chapter_assignments)
      .values(assignments)
      .returning();

    const fixedAssignments = insertedAssignments.map((a) => ({
      ...a,
      isSubmitted: a.isSubmitted === null ? undefined : a.isSubmitted,
    }));

    return { ok: true, data: fixedAssignments };
  } catch {
    return {
      ok: false,
      error: { message: 'Failed to create chapter assignments' },
    };
  }
}

export async function assignUsersToChapters(assignmentData: {
  chapterAssignmentId: number[];
  userId: number;
}): Promise<Result<ChapterAssignment[]>> {
  try {
    const { chapterAssignmentId, userId } = assignmentData;

    const updatedAssignments = await db.transaction(async (tx) => {
      const updated = await tx
        .update(chapter_assignments)
        .set({ assignedUserId: userId })
        .where(inArray(chapter_assignments.id, chapterAssignmentId))
        .returning();

      return updated;
    });

    const fixedAssignments = updatedAssignments.map((a) => ({
      ...a,
      isSubmitted: a.isSubmitted === null ? undefined : a.isSubmitted,
    }));
    return { ok: true, data: fixedAssignments };
  } catch {
    return {
      ok: false,
      error: { message: 'Failed to assign users to chapters' },
    };
  }
}

export async function getChapterAssignmentsByProject(
  projectId: number
): Promise<Result<ChapterAssignment[]>> {
  try {
    const assignments = await db
      .select({
        id: chapter_assignments.id,
        projectUnitId: chapter_assignments.projectUnitId,
        bibleId: chapter_assignments.bibleId,
        bookId: chapter_assignments.bookId,
        chapterNumber: chapter_assignments.chapterNumber,
        assignedUserId: chapter_assignments.assignedUserId,
        isSubmitted: chapter_assignments.isSubmitted,
        submittedTime: chapter_assignments.submittedTime,
        createdAt: chapter_assignments.createdAt,
        updatedAt: chapter_assignments.updatedAt,
      })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .where(eq(project_units.projectId, projectId))
      .orderBy(chapter_assignments.bookId, chapter_assignments.chapterNumber);

    const fixedAssignments = assignments.map((a) => ({
      ...a,
      isSubmitted: a.isSubmitted === null ? undefined : a.isSubmitted,
    }));
    return { ok: true, data: fixedAssignments };
  } catch {
    return {
      ok: false,
      error: { message: 'Failed to fetch chapter assignments' },
    };
  }
}

export async function deleteChapterAssignmentsByProject(
  projectId: number
): Promise<Result<{ deletedCount: number }>> {
  try {
    const result = await db.transaction(async (tx) => {
      const [projectUnit] = await tx
        .select({ id: project_units.id })
        .from(project_units)
        .where(eq(project_units.projectId, projectId))
        .limit(1);

      if (!projectUnit) {
        return { deletedCount: 0 };
      }

      const deletedAssignments = await tx
        .delete(chapter_assignments)
        .where(eq(chapter_assignments.projectUnitId, projectUnit.id))
        .returning({ id: chapter_assignments.id });

      return { deletedCount: deletedAssignments.length };
    });

    return { ok: true, data: result };
  } catch {
    return {
      ok: false,
      error: { message: 'Failed to delete chapter assignments' },
    };
  }
}
