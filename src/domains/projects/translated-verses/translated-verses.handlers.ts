import type { z } from '@hono/zod-openapi';

import { and, eq } from 'drizzle-orm';

import type {
  insertTranslatedVersesSchema,
  patchTranslatedVersesSchema,
  selectTranslatedVersesSchema,
} from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import { bible_texts, translated_verses } from '@/db/schema';

export type TranslatedVerse = z.infer<typeof selectTranslatedVersesSchema>;
export type CreateTranslatedVerseInput = z.infer<typeof insertTranslatedVersesSchema>;
export type UpdateTranslatedVerseInput = z.infer<typeof patchTranslatedVersesSchema>;

export interface GetTranslatedVersesFilters {
  projectUnitId: number;
  bookId: number;
  chapterNumber: number;
}

export async function getTranslatedVerses(
  filters: GetTranslatedVersesFilters
): Promise<Result<TranslatedVerse[]>> {
  try {
    const verses = await db
      .select({
        id: translated_verses.id,
        projectUnitId: translated_verses.projectUnitId,
        content: translated_verses.content,
        bibleTextId: translated_verses.bibleTextId,
        assignedUserId: translated_verses.assignedUserId,
        createdAt: translated_verses.createdAt,
        updatedAt: translated_verses.updatedAt,
        verseNumber: bible_texts.verseNumber,
      })
      .from(translated_verses)
      .innerJoin(bible_texts, eq(translated_verses.bibleTextId, bible_texts.id))
      .where(
        and(
          eq(translated_verses.projectUnitId, filters.projectUnitId),
          eq(bible_texts.bookId, filters.bookId),
          eq(bible_texts.chapterNumber, filters.chapterNumber)
        )
      )
      .orderBy(bible_texts.verseNumber);

    return { ok: true, data: verses };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch translated verses' } };
  }
}
