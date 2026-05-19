import { and, eq, inArray } from 'drizzle-orm';

import type { DbTransaction, Result } from '@/lib/types';

import { db } from '@/db';
import { ai_suggestion_jobs, ai_suggestions } from '@/db/schema';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

export async function queueAiSuggestionJobs(
  jobs: {
    projectUnitId: number;
    bibleId: number;
    bookCode: string;
    chapterNumber: number;
    verseStart: number;
    verseEnd: number;
  }[],
  tx?: DbTransaction
): Promise<Result<void>> {
  const database = tx || db;
  try {
    if (jobs.length === 0) return ok(undefined);

    logger.debug({
      msg: '[AI Suggestions] inserting jobs into ai.ai_suggestion_jobs',
      jobCount: jobs.length,
      firstJob: jobs[0],
    });

    await database
      .insert(ai_suggestion_jobs)
      .values(jobs)
      // If the frontend fires multiple queue requests rapidly for the same verse,
      // the unique constraint ensures we safely ignore duplicate jobs.
      .onConflictDoNothing({
        target: [
          ai_suggestion_jobs.projectUnitId,
          ai_suggestion_jobs.bookCode,
          ai_suggestion_jobs.chapterNumber,
          ai_suggestion_jobs.verseStart,
          ai_suggestion_jobs.verseEnd,
        ],
      });

    logger.debug({ msg: '[AI Suggestions] jobs inserted successfully' });
    return ok(undefined);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to queue AI suggestion jobs',
      context: { jobCount: jobs.length },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function getAiSuggestions(
  projectUnitId: number,
  bibleTextIds: number[],
  tx?: DbTransaction
) {
  const database = tx || db;
  try {
    if (bibleTextIds.length === 0) return ok([]);

    logger.debug({
      msg: '[AI Suggestions] fetching from ai.ai_suggestions',
      projectUnitId,
      bibleTextIdCount: bibleTextIds.length,
      bibleTextIds,
    });

    const results = await database
      .select()
      .from(ai_suggestions)
      .where(
        and(
          eq(ai_suggestions.projectUnitId, projectUnitId),
          inArray(ai_suggestions.bibleTextId, bibleTextIds)
        )
      );

    logger.debug({
      msg: '[AI Suggestions] fetch result',
      resultsCount: results.length,
    });

    return ok(results);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to fetch AI suggestions',
      context: { projectUnitId, textIdsCount: bibleTextIds.length },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
