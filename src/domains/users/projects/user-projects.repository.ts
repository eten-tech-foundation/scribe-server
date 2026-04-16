import { eq } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { project_unit_bible_books, project_units, project_users, projects } from '@/db/schema';
import {
  chapterStatusCountsSubquery,
  lastActivitySubquery,
  projectWithLangNames,
  sourceBibles,
  sourceLanguages,
  targetLanguages,
} from '@/domains/projects/projects.query-builder';
import { mapToProjectWithLanguages } from '@/domains/projects/projects.repository';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type { ProjectWithLanguageNames } from './user-projects.types';

export async function findByUserId(userId: number): Promise<Result<ProjectWithLanguageNames[]>> {
  try {
    const rows = await db
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

    return ok(rows.map(mapToProjectWithLanguages));
  } catch (e) {
    logger.error({ cause: e, message: 'Failed to fetch user projects', context: { userId } });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
