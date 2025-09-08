import { and, count, eq, inArray, sql } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import {
  bible_texts,
  books,
  chapter_assignments,
  project_unit_bible_books,
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
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface ChapterInfo {
  bibleId: number;
  bookId: number;
  chapterNumber: number;
  verseCount: number;
}

export interface ChapterAssignmentProgress {
  book: string;
  chapter_number: number;
  assigned_user: string;
  project_unit_id: number;
  assignment_id: number;
  progress: string;
}

export interface ChapterAssignmentByEmail {
  project_name: string;
  project_unit_id: number;
  book_id: number;
  book: string;
  chapter_number: number;
  progress: string;
  is_submitted: boolean;
  submitted_time: string | null;
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

export async function getChapterAssignmentProgressByProject(
  projectId: number
): Promise<Result<ChapterAssignmentProgress[]>> {
  try {
    // First, get all chapter assignments for the project
    const assignments = await db
      .select({
        assignmentId: chapter_assignments.id,
        projectUnitId: chapter_assignments.projectUnitId,
        bibleId: chapter_assignments.bibleId,
        bookId: chapter_assignments.bookId,
        chapterNumber: chapter_assignments.chapterNumber,
        assignedUserId: chapter_assignments.assignedUserId,
        bookName: books.eng_display_name,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .innerJoin(books, eq(chapter_assignments.bookId, books.id))
      .leftJoin(users, eq(chapter_assignments.assignedUserId, users.id))
      .where(eq(project_units.projectId, projectId))
      .orderBy(books.eng_display_name, chapter_assignments.chapterNumber);

    // Get progress for each assignment
    const progressData: ChapterAssignmentProgress[] = [];

    for (const assignment of assignments) {
      // Get total verse count
      const totalVerses = await db
        .select({
          count: count(),
        })
        .from(bible_texts)
        .where(
          and(
            eq(bible_texts.bibleId, assignment.bibleId),
            eq(bible_texts.bookId, assignment.bookId),
            eq(bible_texts.chapterNumber, assignment.chapterNumber)
          )
        );

      // Get completed verse count
      const completedVerses = await db
        .select({
          count: count(),
        })
        .from(bible_texts)
        .innerJoin(translated_verses, eq(bible_texts.id, translated_verses.bibleTextId))
        .where(
          and(
            eq(bible_texts.bibleId, assignment.bibleId),
            eq(bible_texts.bookId, assignment.bookId),
            eq(bible_texts.chapterNumber, assignment.chapterNumber)
          )
        );

      const totalCount = totalVerses[0]?.count || 0;
      const completedCount = completedVerses[0]?.count || 0;
      const assignedUser =
        assignment.firstName && assignment.lastName
          ? `${assignment.firstName} ${assignment.lastName}`
          : '';

      progressData.push({
        book: assignment.bookName,
        chapter_number: assignment.chapterNumber,
        assigned_user: assignedUser,
        project_unit_id: assignment.projectUnitId,
        assignment_id: assignment.assignmentId,
        progress: `${completedCount} of ${totalCount}`,
      });
    }

    return { ok: true, data: progressData };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch chapter assignment progress' } };
  }
}

export async function getChapterAssignmentsByEmail(
  email: string
): Promise<Result<ChapterAssignmentByEmail[]>> {
  try {
    // First, get the user ID
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user.length) {
      return { ok: true, data: [] };
    }

    const userId = user[0].id;

    // Get assignments for the user
    const assignments = await db
      .select({
        assignmentId: chapter_assignments.id,
        projectName: projects.name,
        projectUnitId: chapter_assignments.projectUnitId,
        bookId: chapter_assignments.bookId,
        bookName: books.eng_display_name,
        chapterNumber: chapter_assignments.chapterNumber,
        bibleId: chapter_assignments.bibleId,
        isSubmitted: chapter_assignments.isSubmitted,
        submittedTime: chapter_assignments.submittedTime,
      })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .innerJoin(projects, eq(project_units.projectId, projects.id))
      .innerJoin(books, eq(chapter_assignments.bookId, books.id))
      .where(eq(chapter_assignments.assignedUserId, userId))
      .orderBy(projects.name, books.eng_display_name, chapter_assignments.chapterNumber);

    // Get progress for each assignment
    const assignmentsWithProgress: ChapterAssignmentByEmail[] = [];

    for (const assignment of assignments) {
      // Get total verse count
      const totalVerses = await db
        .select({
          count: count(),
        })
        .from(bible_texts)
        .where(
          and(
            eq(bible_texts.bibleId, assignment.bibleId),
            eq(bible_texts.bookId, assignment.bookId),
            eq(bible_texts.chapterNumber, assignment.chapterNumber)
          )
        );

      // Get completed verse count for this user
      const completedVerses = await db
        .select({
          count: count(),
        })
        .from(bible_texts)
        .innerJoin(translated_verses, eq(bible_texts.id, translated_verses.bibleTextId))
        .where(
          and(
            eq(bible_texts.bibleId, assignment.bibleId),
            eq(bible_texts.bookId, assignment.bookId),
            eq(bible_texts.chapterNumber, assignment.chapterNumber),
            eq(translated_verses.assignedUserId, userId)
          )
        );

      const totalCount = totalVerses[0]?.count || 0;
      const completedCount = completedVerses[0]?.count || 0;

      assignmentsWithProgress.push({
        project_name: assignment.projectName,
        project_unit_id: assignment.projectUnitId,
        book_id: assignment.bookId,
        book: assignment.bookName,
        chapter_number: assignment.chapterNumber,
        progress: `${completedCount} of ${totalCount}`,
        is_submitted: assignment.isSubmitted || false,
        submitted_time: assignment.submittedTime?.toISOString() || null,
      });
    }

    return { ok: true, data: assignmentsWithProgress };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch chapter assignments by email' } };
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

export async function assignUsersToChapters(assignmentData: {
  chapterAssignmentId: number[];
  userId: number;
}): Promise<Result<ChapterAssignment[]>> {
  try {
    const { chapterAssignmentId, userId } = assignmentData;

    const updatedAssignments = await db.transaction(async (tx) => {
      const updates = [];

      for (const assignmentId of chapterAssignmentId) {
        const [updated] = await tx
          .update(chapter_assignments)
          .set({ assignedUserId: userId })
          .where(eq(chapter_assignments.id, assignmentId))
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
