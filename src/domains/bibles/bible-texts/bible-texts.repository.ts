import { and, eq } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { bible_texts } from '@/db/schema';
import { err, ErrorCode, ok } from '@/lib/types';

import type { BibleTextResponse } from './bible-texts.types';

export async function getByChapter(
  bibleId: number,
  bookId: number,
  chapterNumber: number
): Promise<Result<BibleTextResponse[]>> {
  try {
    const texts = await db
      .select({
        id: bible_texts.id,
        chapterNumber: bible_texts.chapterNumber,
        verseNumber: bible_texts.verseNumber,
        text: bible_texts.text,
      })
      .from(bible_texts)
      .where(
        and(
          eq(bible_texts.bibleId, bibleId),
          eq(bible_texts.bookId, bookId),
          eq(bible_texts.chapterNumber, chapterNumber)
        )
      )
      .orderBy(bible_texts.verseNumber);

    if (texts.length === 0) return err(ErrorCode.NOT_FOUND);
    return ok(texts);
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
