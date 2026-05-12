import { and, asc, eq, gt } from 'drizzle-orm';

import type {Result} from '@/lib/types';

import { db } from '@/db';
import { bible_texts, books } from '@/db/schema';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok  } from '@/lib/types';

import type { AiSuggestionsListResponse, GetAiSuggestionsQuery } from './ai-suggestions.types';

import { getAiSuggestions as getAiSuggestionsRepo, queueAiSuggestionJobs } from './ai-suggestions.repository';

export async function getAiSuggestions(
  query: GetAiSuggestionsQuery
): Promise<Result<AiSuggestionsListResponse>> {
  const ids = query.bibleTextIds.split(',').map(id => Number.parseInt(id.trim(), 10)).filter(id => !Number.isNaN(id));
  
  const suggestionsResult = await getAiSuggestionsRepo(query.projectUnitId, ids);

  if (!suggestionsResult.ok) {
    return suggestionsResult;
  }

  const data = suggestionsResult.data.map(suggestion => ({
    bibleTextId: suggestion.bibleTextId,
    suggestedText: suggestion.suggestedText,
    modelInfo: suggestion.modelInfo,
  }));

  return ok({ data });
}

export async function queueNextVerses(
  projectUnitId: number,
  bibleId: number,
  bookCode: string,
  chapterNumber: number,
  currentVerse: number,
  lookahead: number = 5
): Promise<Result<void>> {
  try {
    // 1. Find the next few verses
    const nextVerses = await db
      .select({ verseNumber: bible_texts.verseNumber })
      .from(bible_texts)
      .innerJoin(books, eq(bible_texts.bookId, books.id))
      .where(
        and(
          eq(bible_texts.bibleId, bibleId),
          eq(books.code, bookCode),
          eq(bible_texts.chapterNumber, chapterNumber),
          gt(bible_texts.verseNumber, currentVerse)
        )
      )
      .orderBy(asc(bible_texts.verseNumber))
      .limit(lookahead);

    if (nextVerses.length === 0) return ok(undefined);

    // 2. Queue them
    const jobs = nextVerses.map(v => ({
      projectUnitId,
      bibleId,
      bookCode,
      chapterNumber,
      verseStart: v.verseNumber,
      verseEnd: v.verseNumber,
    }));

    return await queueAiSuggestionJobs(jobs);
  } catch (error) {
    logger.error(error);
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
