import { eq } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { chapterStatusEnum, project_unit_bible_books, project_units, projects } from '@/db/schema';
import * as chapterAssignmentsService from '@/domains/chapter-assignments/chapter-assignments.handlers';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type { RawProjectRow } from './projects.query-builder';
import type {
  ChapterStatusCounts,
  CreateProjectInput,
  Project,
  ProjectUnitRef,
  ProjectWithLanguageNames,
  UpdateProjectInput,
  WorkflowStep,
} from './projects.types';

import { baseJoinQuery } from './projects.query-builder';

const formatLabel = (str: string) =>
  str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const WORKFLOW_DEFINITION: WorkflowStep[] = chapterStatusEnum.enumValues.map((status) => ({
  id: status,
  label: formatLabel(status),
}));

// NOTE: mapper lives here because it is tightly coupled to the raw join shape from baseJoinQuery.
function mapToProjectWithLanguages(rawProject: RawProjectRow): ProjectWithLanguageNames {
  const { counts, ...rest } = rawProject;
  const defaultCounts = chapterStatusEnum.enumValues.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as ChapterStatusCounts);

  return {
    ...rest,
    chapterStatusCounts: { ...defaultCounts, ...(counts || {}) },
    workflowConfig: WORKFLOW_DEFINITION,
  };
}

// ─── Repository functions ─────────────────────────────────────────────────────

export async function getByOrganization(
  organizationId: number
): Promise<Result<ProjectWithLanguageNames[]>> {
  try {
    const rawProjects = await baseJoinQuery().where(eq(projects.organization, organizationId));
    return ok(rawProjects.map(mapToProjectWithLanguages));
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function getById(id: number): Promise<Result<ProjectWithLanguageNames>> {
  try {
    const rawProjects = await baseJoinQuery().where(eq(projects.id, id)).limit(1);
    if (rawProjects.length === 0) return err(ErrorCode.PROJECT_NOT_FOUND);
    return ok(mapToProjectWithLanguages(rawProjects[0]));
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function create(input: CreateProjectInput): Promise<Result<Project>> {
  try {
    return await db.transaction(async (tx) => {
      const { bibleId, bookId, projectUnitStatus = 'not_started', ...projectData } = input;

      const [project] = await tx.insert(projects).values(projectData).returning();

      const [projectUnit] = await tx
        .insert(project_units)
        .values({ projectId: project.id, status: projectUnitStatus })
        .returning();

      const bibleBookEntries = bookId.map((id) => ({
        projectUnitId: projectUnit.id,
        bibleId,
        bookId: id,
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

      return ok(project);
    });
  } catch (e) {
    logger.error({
      cause: e,
      message: 'Failed to create project',
      context: {
        organization: input.organization,
        bibleId: input.bibleId,
        bookId: input.bookId,
      },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function update(id: number, input: UpdateProjectInput): Promise<Result<Project>> {
  try {
    return await db.transaction(async (tx) => {
      const { bibleId, bookId, projectUnitStatus, ...projectData } = input;

      const [updated] = await tx
        .update(projects)
        .set(projectData)
        .where(eq(projects.id, id))
        .returning();

      if (!updated) return err(ErrorCode.PROJECT_NOT_FOUND);

      if (projectUnitStatus !== undefined) {
        await tx
          .update(project_units)
          .set({ status: projectUnitStatus })
          .where(eq(project_units.projectId, id));
      }

      return ok(updated);
    });
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function remove(id: number): Promise<Result<void>> {
  try {
    const [deleted] = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    if (!deleted) return err(ErrorCode.PROJECT_NOT_FOUND);
    return ok(undefined);
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function getProjectIdByUnitId(projectUnitId: number): Promise<Result<ProjectUnitRef>> {
  try {
    const [unit] = await db
      .select({ projectId: project_units.projectId })
      .from(project_units)
      .where(eq(project_units.id, projectUnitId))
      .limit(1);

    if (!unit) return err(ErrorCode.PROJECT_UNIT_NOT_FOUND);
    return ok({ projectId: unit.projectId });
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
