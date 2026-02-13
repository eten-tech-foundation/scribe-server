import type { z } from '@hono/zod-openapi';

import { eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { insertProjectsSchema, patchProjectsSchema, selectProjectsSchema } from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import {
  bibles,
  chapter_assignments,
  languages,
  project_unit_bible_books,
  project_units,
  projects,
} from '@/db/schema';
import * as chapterAssignmentsService from '@/domains/chapter-assignments/chapter-assignments.handlers';

export type Project = z.infer<typeof selectProjectsSchema>;

export type CreateProjectInput = Omit<z.infer<typeof insertProjectsSchema>, 'status'> & {
  bibleId: number;
  bookId: number[];
  projectUnitStatus?: 'not_started' | 'in_progress' | 'completed';
};

export type UpdateProjectInput = Omit<z.infer<typeof patchProjectsSchema>, 'status'> & {
  bibleId?: number;
  bookId?: number[];
  projectUnitStatus?: 'not_started' | 'in_progress' | 'completed';
};

export type ProjectWithLanguageNames = Omit<Project, 'sourceLanguage' | 'targetLanguage'> & {
  sourceLanguageName: string;
  targetLanguageName: string;
  sourceName: string;
  lastChapterActivity: Date | null;
};

const sourceLanguages = alias(languages, 'sourceLanguages');
const targetLanguages = alias(languages, 'targetLanguages');
const sourceBibles = alias(bibles, 'sourceBibles');

const lastActivitySubquery = db
  .select({
    projectId: project_units.projectId,
    lastChapterActivity: sql<Date>`MAX(${chapter_assignments.updatedAt})`.as(
      'last_chapter_activity'
    ),
  })
  .from(chapter_assignments)
  .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
  .groupBy(project_units.projectId)
  .as('last_activity');

const projectWithLangNames = {
  id: projects.id,
  name: projects.name,
  organization: projects.organization,
  isActive: projects.isActive,
  status: projects.status,
  createdBy: projects.createdBy,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
  metadata: projects.metadata,
  sourceLanguageName: sourceLanguages.langName,
  targetLanguageName: targetLanguages.langName,
  sourceName: sourceBibles.name,
  lastChapterActivity: lastActivitySubquery.lastChapterActivity,
} as const;

const baseJoinQuery = () =>
  db
    .selectDistinct(projectWithLangNames)
    .from(projects)
    .innerJoin(sourceLanguages, eq(projects.sourceLanguage, sourceLanguages.id))
    .innerJoin(targetLanguages, eq(projects.targetLanguage, targetLanguages.id))
    .innerJoin(project_units, eq(project_units.projectId, projects.id))
    .innerJoin(
      project_unit_bible_books,
      eq(project_unit_bible_books.projectUnitId, project_units.id)
    )
    .innerJoin(sourceBibles, eq(sourceBibles.id, project_unit_bible_books.bibleId))
    .leftJoin(lastActivitySubquery, eq(projects.id, lastActivitySubquery.projectId));

export async function getAllProjects(): Promise<Result<ProjectWithLanguageNames[]>> {
  try {
    const projectList = await baseJoinQuery();
    return { ok: true, data: projectList };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch projects' } };
  }
}

export async function getProjectsByOrganization(
  organizationId: number
): Promise<Result<ProjectWithLanguageNames[]>> {
  try {
    const projectList = await baseJoinQuery().where(eq(projects.organization, organizationId));
    return { ok: true, data: projectList };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch organization projects' } };
  }
}

export async function getProjectById(id: number): Promise<Result<ProjectWithLanguageNames>> {
  try {
    const [project] = await baseJoinQuery().where(eq(projects.id, id)).limit(1);

    if (!project) {
      return { ok: false, error: { message: 'Project not found' } };
    }

    return { ok: true, data: project };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch project' } };
  }
}

export async function createProject(input: CreateProjectInput): Promise<Result<Project>> {
  try {
    return await db.transaction(async (tx) => {
      const { bibleId, bookId, projectUnitStatus = 'not_started', ...projectData } = input;

      const [project] = await tx.insert(projects).values(projectData).returning();

      const [projectUnit] = await tx
        .insert(project_units)
        .values({
          projectId: project.id,
          status: projectUnitStatus,
        })
        .returning();

      const bibleBookEntries = bookId.map((bookId) => ({
        projectUnitId: projectUnit.id,
        bibleId,
        bookId,
      }));

      if (bibleBookEntries.length > 0) {
        await tx.insert(project_unit_bible_books).values(bibleBookEntries);
      }

      const assignmentsResult =
        await chapterAssignmentsService.createChapterAssignmentForProjectUnit(
          projectUnit.id,
          bibleId,
          bookId,
          tx
        );

      if (!assignmentsResult.ok) {
        throw new Error(assignmentsResult.error.message);
      }

      return { ok: true, data: project };
    });
  } catch {
    return { ok: false, error: { message: 'Failed to create project' } };
  }
}

export async function updateProject(
  id: number,
  input: UpdateProjectInput
): Promise<Result<Project>> {
  try {
    return await db.transaction(async (tx) => {
      const { bibleId, bookId, projectUnitStatus, ...projectData } = input;

      const [updated] = await tx
        .update(projects)
        .set(projectData)
        .where(eq(projects.id, id))
        .returning();

      if (!updated) {
        return { ok: false, error: { message: 'Project not found' } };
      }

      if (bibleId !== undefined || bookId !== undefined || projectUnitStatus !== undefined) {
        await tx.delete(project_units).where(eq(project_units.projectId, id));

        const [projectUnit] = await tx
          .insert(project_units)
          .values({
            projectId: id,
            status: projectUnitStatus || 'not_started',
          })
          .returning();

        if (bibleId !== undefined && bookId !== undefined) {
          const bibleBookEntries = bookId.map((bookId) => ({
            projectUnitId: projectUnit.id,
            bibleId,
            bookId,
          }));

          if (bibleBookEntries.length > 0) {
            await tx.insert(project_unit_bible_books).values(bibleBookEntries);
          }

          const assignmentsResult =
            await chapterAssignmentsService.createChapterAssignmentForProjectUnit(
              projectUnit.id,
              bibleId,
              bookId,
              tx
            );

          if (!assignmentsResult.ok) {
            throw new Error(assignmentsResult.error.message);
          }
        }
      }

      return { ok: true, data: updated };
    });
  } catch {
    return { ok: false, error: { message: 'Failed to update project' } };
  }
}

export async function deleteProject(id: number): Promise<Result<{ id: number }>> {
  try {
    const result = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });

    if (result.length === 0) {
      return { ok: false, error: { message: 'Project not found' } };
    }

    return { ok: true, data: { id: result[0].id } };
  } catch {
    return { ok: false, error: { message: 'Failed to delete project' } };
  }
}
