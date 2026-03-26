import type { z } from '@hono/zod-openapi';

import { eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { insertProjectsSchema, patchProjectsSchema, selectProjectsSchema } from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import {
  bibles,
  chapter_assignments,
  chapterStatusEnum,
  languages,
  project_unit_bible_books,
  project_units,
  projects,
} from '@/db/schema';
import * as chapterAssignmentsService from '@/domains/chapter-assignments/chapter-assignments.service';

export type Project = z.infer<typeof selectProjectsSchema>;

export type ChapterStatusCounts = Record<string, number>;

export interface WorkflowStep {
  id: string;
  label: string;
}
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
  chapterStatusCounts: ChapterStatusCounts;
  workflowConfig: WorkflowStep[];
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

const rawCountsSubquery = db
  .select({
    projectId: project_units.projectId,
    status: chapter_assignments.status,
    count: sql<number>`count(*)::int`.as('count'),
  })
  .from(chapter_assignments)
  .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
  .groupBy(project_units.projectId, chapter_assignments.status)
  .as('raw_counts');

const chapterStatusCountsSubquery = db
  .select({
    projectId: rawCountsSubquery.projectId,
    counts: sql<Record<string, number>>`
      jsonb_object_agg(
        ${rawCountsSubquery.status}, 
        ${rawCountsSubquery.count}
      )
    `.as('counts'),
  })
  .from(rawCountsSubquery)
  .groupBy(rawCountsSubquery.projectId)
  .as('chapter_status_counts');

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
  counts: chapterStatusCountsSubquery.counts,
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
    .leftJoin(lastActivitySubquery, eq(projects.id, lastActivitySubquery.projectId))
    .leftJoin(chapterStatusCountsSubquery, eq(projects.id, chapterStatusCountsSubquery.projectId))
    .groupBy(
      projects.id,
      sourceLanguages.id,
      targetLanguages.id,
      sourceBibles.id,
      lastActivitySubquery.lastChapterActivity,
      chapterStatusCountsSubquery.counts
    );

const formatLabel = (str: string) => {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const WORKFLOW_DEFINITION: WorkflowStep[] = chapterStatusEnum.enumValues.map((status) => ({
  id: status,
  label: formatLabel(status),
}));

type BaseJoinQueryResult = Awaited<ReturnType<typeof baseJoinQuery>>;
type RawProjectRow = BaseJoinQueryResult[number];

function mapProjectDataToProjectWithLanguages(rawProject: RawProjectRow): ProjectWithLanguageNames {
  const { counts, ...rest } = rawProject;
  const defaultCounts = chapterStatusEnum.enumValues.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as ChapterStatusCounts);

  const finalCounts = {
    ...defaultCounts,
    ...(counts || {}),
  };

  return {
    ...rest,
    chapterStatusCounts: finalCounts,
    workflowConfig: WORKFLOW_DEFINITION,
  };
}

export async function getProjectsByOrganization(
  organizationId: number
): Promise<Result<ProjectWithLanguageNames[]>> {
  try {
    const rawProjects = await baseJoinQuery().where(eq(projects.organization, organizationId));
    const projectList = rawProjects.map(mapProjectDataToProjectWithLanguages);
    return { ok: true, data: projectList };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch organization projects' } };
  }
}

export async function getProjectById(id: number): Promise<Result<ProjectWithLanguageNames>> {
  try {
    const rawProjects = await baseJoinQuery().where(eq(projects.id, id)).limit(1);

    if (rawProjects.length === 0) {
      return { ok: false, error: { message: 'Project not found' } };
    }

    const project = mapProjectDataToProjectWithLanguages(rawProjects[0]);

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

      if (projectUnitStatus !== undefined) {
        await tx
          .update(project_units)
          .set({ status: projectUnitStatus })
          .where(eq(project_units.projectId, id));
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

export async function getProjectIdByUnitId(
  projectUnitId: number
): Promise<Result<{ projectId: number }>> {
  try {
    const [unit] = await db
      .select({ projectId: project_units.projectId })
      .from(project_units)
      .where(eq(project_units.id, projectUnitId))
      .limit(1);

    if (!unit) {
      return { ok: false, error: { message: 'Project unit not found' } };
    }

    return { ok: true, data: { projectId: unit.projectId } };
  } catch {
    return { ok: false, error: { message: 'Failed to resolve project unit' } };
  }
}
