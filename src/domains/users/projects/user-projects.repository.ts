import { eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import {
  bibles,
  chapter_assignments,
  chapterStatusEnum,
  languages,
  project_unit_bible_books,
  project_units,
  project_users,
  projects,
} from '@/db/schema';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type {
  ChapterStatusCounts,
  ProjectWithLanguageNames,
  RawProjectRow,
  WorkflowStep,
} from './user-projects.types';

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

const projectSelectFields = {
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

const WORKFLOW_DEFINITION: WorkflowStep[] = chapterStatusEnum.enumValues.map((status) => ({
  id: status,
  label: status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' '),
}));

function mapRow(raw: RawProjectRow): ProjectWithLanguageNames {
  const { counts, ...rest } = raw;
  const defaultCounts = chapterStatusEnum.enumValues.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as ChapterStatusCounts);

  return {
    ...rest,
    chapterStatusCounts: { ...defaultCounts, ...(counts ?? {}) },
    workflowConfig: WORKFLOW_DEFINITION,
  };
}

export async function findByUserId(userId: number): Promise<Result<ProjectWithLanguageNames[]>> {
  try {
    const rows = await db
      .selectDistinct(projectSelectFields)
      .from(projects)
      .innerJoin(sourceLanguages, eq(projects.sourceLanguage, sourceLanguages.id))
      .innerJoin(targetLanguages, eq(projects.targetLanguage, targetLanguages.id))
      .innerJoin(project_units, eq(project_units.projectId, projects.id))
      .innerJoin(
        project_unit_bible_books,
        eq(project_unit_bible_books.projectUnitId, project_units.id)
      )
      .innerJoin(sourceBibles, eq(sourceBibles.id, project_unit_bible_books.bibleId))
      .innerJoin(project_users, eq(project_users.projectId, projects.id))
      .leftJoin(lastActivitySubquery, eq(projects.id, lastActivitySubquery.projectId))
      .leftJoin(chapterStatusCountsSubquery, eq(projects.id, chapterStatusCountsSubquery.projectId))
      .where(eq(project_users.userId, userId))
      .groupBy(
        projects.id,
        sourceLanguages.id,
        targetLanguages.id,
        sourceBibles.id,
        lastActivitySubquery.lastChapterActivity,
        chapterStatusCountsSubquery.counts
      );

    return ok(rows.map(mapRow));
  } catch (e) {
    logger.error({ cause: e, message: 'Failed to fetch user projects', context: { userId } });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
