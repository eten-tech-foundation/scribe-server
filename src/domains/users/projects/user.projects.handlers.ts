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

export type ChapterStatusCounts = Record<string, number>;

export interface WorkflowStep {
  id: string;
  label: string;
}

export interface ProjectWithLanguageNames {
  id: number;
  name: string;
  organization: number;
  isActive: boolean | null;
  status: 'active' | 'not_assigned';
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  metadata: unknown;
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

const baseJoinQuery = (userId: number) =>
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

  return {
    ...rest,
    chapterStatusCounts: { ...defaultCounts, ...(counts || {}) },
    workflowConfig: WORKFLOW_DEFINITION,
  };
}

export async function getProjectsByUserId(
  userId: number
): Promise<Result<ProjectWithLanguageNames[]>> {
  try {
    const rawProjects = await baseJoinQuery(userId);
    const projectList = rawProjects.map(mapProjectDataToProjectWithLanguages);
    return { ok: true, data: projectList };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch user projects' } };
  }
}