import { and, eq } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { bible_texts } from '@/db/schema';

export interface BibleText {
  id: number;
  chapterNumber: number;
  verseNumber: number;
  text: string;
}

export async function getBibleTextsByChapter(
  bibleId: number,
  bookId: number,
  chapterNumber: number
): Promise<Result<BibleText[]>> {
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

    if (texts.length === 0) {
      return { ok: false, error: { message: 'Bible texts not found for the specified chapter' } };
    }

    return { ok: true, data: texts };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch bible texts' } };
  }
}
