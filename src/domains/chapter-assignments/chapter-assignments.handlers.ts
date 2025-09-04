import { and, eq, inArray, sql } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import {
  bible_texts,
  chapter_assignments,
  project_unit_bible_books,
  project_units,
} from '@/db/schema';

export interface ChapterAssignment {
  id?: number;
  projectUnitId: number;
  bibleId: number;
  bookId: number;
  chapterNumber: number;
  assignedUserId: number | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface ChapterInfo {
  bibleId: number;
  bookId: number;
  chapterNumber: number;
  verseCount: number;
}

export async function getProjectChapters(projectId: number): Promise<Result<ChapterInfo[]>> {
  try {
    const chapters = await db
      .select({
        bibleId: bible_texts.bibleId,
        bookId: bible_texts.bookId,
        chapterNumber: bible_texts.chapterNumber,
        verseCount: sql<number>`COUNT(${bible_texts.verseNumber})`.as('verseCount'),
      })
      .from(bible_texts)
      .innerJoin(
        project_unit_bible_books,
        and(
          eq(bible_texts.bibleId, project_unit_bible_books.bibleId),
          eq(bible_texts.bookId, project_unit_bible_books.bookId)
        )
      )
      .innerJoin(project_units, eq(project_unit_bible_books.projectUnitId, project_units.id))
      .where(eq(project_units.projectId, projectId))
      .groupBy(bible_texts.bibleId, bible_texts.bookId, bible_texts.chapterNumber)
      .orderBy(bible_texts.bookId, bible_texts.chapterNumber);

    return { ok: true, data: chapters };
  } catch {
    return {
      ok: false,
      error: { message: 'Failed to fetch project chapters' },
    };
  }
}

export async function createChapterAssignments(
  projectUnitId: number,
  bibleId: number,
  bookIds: number[],
  tx: any
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

    return { ok: true, data: insertedAssignments };
  } catch {
    return {
      ok: false,
      error: { message: 'Failed to create chapter assignments' },
    };
  }
}

export async function assignUsersToChapters(
  projectId: number,
  userAssignments: Array<{
    chapterAssignmentId: number;
    userId: number;
  }>
): Promise<Result<ChapterAssignment[]>> {
  try {
    const updatedAssignments = await db.transaction(async (tx) => {
      const updates = [];

      for (const assignment of userAssignments) {
        const [updated] = await tx
          .update(chapter_assignments)
          .set({ assignedUserId: assignment.userId })
          .where(eq(chapter_assignments.id, assignment.chapterAssignmentId))
          .returning();

        if (updated) {
          updates.push(updated);
        }
      }

      return updates;
    });

    return { ok: true, data: updatedAssignments };
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
        createdAt: chapter_assignments.createdAt,
        updatedAt: chapter_assignments.updatedAt,
      })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .where(eq(project_units.projectId, projectId))
      .orderBy(chapter_assignments.bookId, chapter_assignments.chapterNumber);

    return { ok: true, data: assignments };
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
