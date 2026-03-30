import { and, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { ChapterAssignmentRecord } from '@/domains/chapter-assignments/chapter-assignments.types';
import type { DbTransaction, Result } from '@/lib/types';

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
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type { ChapterAssignmentProgress } from './project-chapter-assignments.types';

export async function getByProject(projectId: number): Promise<Result<ChapterAssignmentRecord[]>> {
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

    return ok(assignments);
  } catch (e) {
    logger.error({
      cause: e,
      message: 'Failed to get project chapter assignments',
      context: { projectId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function deleteByProject(
  projectId: number
): Promise<Result<{ deletedCount: number }>> {
  try {
    return await db.transaction(async (tx) => {
      const [projectUnit] = await tx
        .select({ id: project_units.id })
        .from(project_units)
        .where(eq(project_units.projectId, projectId))
        .limit(1);

      if (!projectUnit) return ok({ deletedCount: 0 });

      const deletedAssignments = await tx
        .delete(chapter_assignments)
        .where(eq(chapter_assignments.projectUnitId, projectUnit.id))
        .returning({ id: chapter_assignments.id });

      return ok({ deletedCount: deletedAssignments.length });
    });
  } catch (e) {
    logger.error({
      cause: e,
      message: 'Failed to delete chapter assignments for project',
      context: { projectId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function getProgressByProject(
  projectId: number
): Promise<Result<ChapterAssignmentProgress[]>> {
  try {
    const assignedUser = alias(users, 'assignedUser');
    const peerChecker = alias(users, 'peerChecker');

    const rows = await db
      .select({
        assignmentId: chapter_assignments.id,
        projectUnitId: chapter_assignments.projectUnitId,
        bibleId: chapter_assignments.bibleId,
        bookId: chapter_assignments.bookId,
        bookCode: books.code,
        sourceLangCode: languages.langCodeIso6393,
        chapterNumber: chapter_assignments.chapterNumber,
        status: chapter_assignments.status,
        bookNameEng: books.eng_display_name,
        assignedUserId: chapter_assignments.assignedUserId,
        assignedUserDisplayName: assignedUser.username,
        peerCheckerId: chapter_assignments.peerCheckerId,
        peerCheckerDisplayName: peerChecker.username,
        submittedTime: chapter_assignments.submittedTime,
        createdAt: chapter_assignments.createdAt,
        updatedAt: chapter_assignments.updatedAt,
        totalVerses: sql<number>`COUNT(${bible_texts.id})`,
        completedVerses: sql<number>`COUNT(CASE WHEN ${translated_verses.content} != '' AND ${translated_verses.content} IS NOT NULL THEN 1 END)`,
      })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .innerJoin(books, eq(chapter_assignments.bookId, books.id))
      .innerJoin(bibles, eq(bibles.id, chapter_assignments.bibleId))
      .innerJoin(languages, eq(languages.id, bibles.languageId))
      .leftJoin(assignedUser, eq(chapter_assignments.assignedUserId, assignedUser.id))
      .leftJoin(peerChecker, eq(chapter_assignments.peerCheckerId, peerChecker.id))
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
        books.code,
        languages.langCodeIso6393,
        assignedUser.id,
        peerChecker.id
      )
      .orderBy(books.eng_display_name, chapter_assignments.chapterNumber);

    const progressData: ChapterAssignmentProgress[] = rows.map((row) => ({
      assignmentId: row.assignmentId,
      projectUnitId: row.projectUnitId,
      status: row.status,
      bookNameEng: row.bookNameEng,
      chapterNumber: row.chapterNumber,
      bibleId: row.bibleId,
      bookId: row.bookId,
      bookCode: row.bookCode,
      sourceLangCode: row.sourceLangCode ?? '',
      assignedUser: row.assignedUserId
        ? { id: row.assignedUserId, displayName: row.assignedUserDisplayName ?? '' }
        : null,
      peerChecker: row.peerCheckerId
        ? { id: row.peerCheckerId, displayName: row.peerCheckerDisplayName ?? '' }
        : null,
      totalVerses: Number(row.totalVerses),
      completedVerses: Number(row.completedVerses),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      submittedTime: row.submittedTime,
    }));

    return ok(progressData);
  } catch (e) {
    logger.error({
      cause: e,
      message: 'Failed to get chapter assignment progress',
      context: { projectId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function isUserInProjectOrganization(
  userId: number,
  projectId: number,
  tx?: DbTransaction
): Promise<boolean> {
  const conn = tx ?? db;
  const [match] = await conn
    .select({ id: users.id })
    .from(users)
    .innerJoin(projects, eq(users.organization, projects.organization))
    .where(and(eq(users.id, userId), eq(projects.id, projectId)))
    .limit(1);
  return !!match;
}

export async function getAssignmentIdsByProject(
  projectId: number,
  tx?: DbTransaction
): Promise<number[]> {
  const conn = tx ?? db;
  const rows = await conn
    .select({ id: chapter_assignments.id })
    .from(chapter_assignments)
    .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
    .where(eq(project_units.projectId, projectId));

  return rows.map((r) => r.id);
}
