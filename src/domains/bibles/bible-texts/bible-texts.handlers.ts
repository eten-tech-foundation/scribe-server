import type { z } from '@hono/zod-openapi';

import { and, eq } from 'drizzle-orm';

import type { selectBibleTextsSchema } from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import { bible_texts } from '@/db/schema';

export type BibleText = z.infer<typeof selectBibleTextsSchema>;

export async function getBibleTextsByChapter(
  bibleId: number,
  bookId: number,
  chapterNumber: number
): Promise<Result<BibleText[]>> {
  try {
    const texts = await db
      .select()
      .from(bible_texts)
      .where(
        and(
          eq(bible_texts.bibleId, bibleId),
          eq(bible_texts.bookId, bookId),
          eq(bible_texts.chapterNumber, chapterNumber)
        )
      )
      .orderBy(bible_texts.verseNumber);

    return { ok: true, data: texts };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch bible texts' } };
  }
}
