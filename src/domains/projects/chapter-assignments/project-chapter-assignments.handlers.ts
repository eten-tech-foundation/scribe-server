import { and, eq, inArray, sql } from 'drizzle-orm';

import type { ChapterAssignmentRecord } from '@/domains/chapter-assignments/chapter-assignments.handlers';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import {
  bible_texts,
  books,
  chapter_assignments,
  organizations,
  project_units,
  translated_verses,
  users,
} from '@/db/schema';
import { logger } from '@/lib/logger';

// -------------------------------
// --- START STANDARD HANDLERS ---
// -------------------------------
export async function getProjectChapterAssignments(
  projectId: number
): Promise<Result<ChapterAssignmentRecord[]>> {
  try {
    const assignments = await db
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
      })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .where(eq(project_units.projectId, projectId));

    return { ok: true, data: assignments };
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to get project chapter assignments',
      context: {
        projectId,
      },
    });
    return { ok: false, error: { message: 'Failed to get project chapter assignments' } };
  }
}

export async function deleteChapterAssignmentsByProject(
  projectId: number
): Promise<Result<{ deletedCount: number }>> {
  try {
    return await db.transaction(async (tx) => {
      const [projectUnit] = await tx
        .select({ id: project_units.id })
        .from(project_units)
        .where(eq(project_units.projectId, projectId))
        .limit(1);

      if (!projectUnit) {
        return { ok: true, data: { deletedCount: 0 } };
      }

      const deletedAssignments = await tx
        .delete(chapter_assignments)
        .where(eq(chapter_assignments.projectUnitId, projectUnit.id))
        .returning({ id: chapter_assignments.id });

      return { ok: true, data: { deletedCount: deletedAssignments.length } };
    });
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to delete chapter assignments for project',
      context: {
        projectId,
      },
    });

    return {
      ok: false,
      error: { message: 'Failed to delete chapter assignments' },
    };
  }
}
// -----------------------------
// --- END STANDARD HANDLERS ---
// -----------------------------

// -----------------------------------
// --- START NON-STANDARD HANDLERS ---
// -----------------------------------
export interface ChapterAssignmentProgress {
  assignmentId: number;
  projectUnitId: number;
  bookNameEng: string;
  chapterNumber: number;
  assignedUser: User | null;
  totalVerses: number;
  completedVerses: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  submittedTime: Date | null;
}

interface User {
  id: number;
  displayName: string;
}

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
        bookNameEng: books.eng_display_name,
        assignedUserId: chapter_assignments.assignedUserId,
        assignedUserDisplayName: users.username,
        submittedTime: chapter_assignments.submittedTime,
        createdAt: chapter_assignments.createdAt,
        updatedAt: chapter_assignments.updatedAt,
        totalVerses: sql<number>`COUNT(${bible_texts.id})`,
        completedVerses: sql<number>`COUNT(CASE WHEN ${translated_verses.content} != '' AND ${translated_verses.content} IS NOT NULL THEN 1 END)`,
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
      .leftJoin(
        translated_verses,
        and(
          eq(translated_verses.bibleTextId, bible_texts.id),
          eq(translated_verses.projectUnitId, chapter_assignments.projectUnitId)
        )
      )
      .where(eq(project_units.projectId, projectId))
      .groupBy(
        chapter_assignments.id,
        chapter_assignments.projectUnitId,
        chapter_assignments.bibleId,
        chapter_assignments.bookId,
        chapter_assignments.chapterNumber,
        chapter_assignments.submittedTime,
        chapter_assignments.createdAt,
        chapter_assignments.updatedAt,
        books.eng_display_name,
        users.id
      )
      .orderBy(books.eng_display_name, chapter_assignments.chapterNumber);

    const progressData: ChapterAssignmentProgress[] = rows.map((row) => {
      return {
        assignmentId: row.assignmentId,
        projectUnitId: row.projectUnitId,
        bookNameEng: row.bookNameEng,
        chapterNumber: row.chapterNumber,
        assignedUser: row.assignedUserId
          ? {
              id: row.assignedUserId,
              displayName: row.assignedUserDisplayName ?? '',
            }
          : null,
        totalVerses: Number(row.totalVerses),
        completedVerses: Number(row.completedVerses),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        submittedTime: row.submittedTime,
      };
    });

    return { ok: true, data: progressData };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch chapter assignment progress' } };
  }
}

export async function assignAllProjectChapterAssignmentsToUser(
  projectId: number,
  assignmentData: {
    assignedUserId: number;
  }
): Promise<Result<ChapterAssignmentRecord[]>> {
  if (!(await isAssignedUserInProjectOrganization(assignmentData.assignedUserId, projectId))) {
    return {
      ok: false,
      error: { message: 'Assigned user is not in project organization' },
    };
  }

  try {
    const updatedAssignments = await db.transaction(async (tx) => {
      const updated = await tx
        .update(chapter_assignments)
        .set({ assignedUserId: assignmentData.assignedUserId })
        .where(
          inArray(
            chapter_assignments.projectUnitId,
            db
              .select({ id: project_units.id })
              .from(project_units)
              .where(eq(project_units.projectId, projectId))
          )
        )
        .returning();

      return updated;
    });

    return { ok: true, data: updatedAssignments };
  } catch (err) {
    logger.error({
      message: 'Failed to assign user to project chapters',
      cause: err,
      context: {
        projectId,
        assignedUserId: assignmentData.assignedUserId,
      },
    });

    return {
      ok: false,
      error: { message: 'Failed to assign user to project chapters' },
    };
  }
}

async function isAssignedUserInProjectOrganization(
  assignedUserId: number,
  projectId: number
): Promise<boolean> {
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(organizations, eq(users.organization, organizations.id))
      .where(eq(users.id, assignedUserId));

    if (!user) {
      return false;
    }

    return true;
  } catch (err) {
    logger.error({
      message: 'Failed to check if user is in project organization',
      cause: err,
      context: {
        assignedUserId,
        projectId,
      },
    });
    return false;
  }
}
// -----------------------------
// --- END STANDARD HANDLERS ---
// -----------------------------
