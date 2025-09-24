import type { z } from '@hono/zod-openapi';

import { and, eq, sql } from 'drizzle-orm';

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

export interface TranslatedVersesFilters {
  projectUnitId?: number;
  bookId?: number;
  chapterNumber?: number;
}

export async function getTranslatedVerseById(id: number): Promise<Result<TranslatedVerse>> {
  try {
    const [verse] = await db
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
      .where(eq(translated_verses.id, id))
      .limit(1);

    if (!verse) {
      return { ok: false, error: { message: 'Translated verse not found' } };
    }

    return { ok: true, data: verse };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch translated verse' } };
  }
}

export async function createTranslatedVerse(
  input: CreateTranslatedVerseInput
): Promise<Result<TranslatedVerse>> {
  try {
    const [verse] = await db.insert(translated_verses).values(input).returning();

    const result = await getTranslatedVerseById(verse.id);
    if (!result.ok) {
      return { ok: false, error: { message: 'Failed to fetch created verse' } };
    }

    return { ok: true, data: result.data };
  } catch {
    return { ok: false, error: { message: 'Failed to create translated verse' } };
  }
}

export async function updateTranslatedVerse(
  id: number,
  input: UpdateTranslatedVerseInput
): Promise<Result<TranslatedVerse>> {
  try {
    const [updated] = await db
      .update(translated_verses)
      .set(input)
      .where(eq(translated_verses.id, id))
      .returning();

    if (!updated) {
      return { ok: false, error: { message: 'Translated verse not found' } };
    }

    const result = await getTranslatedVerseById(updated.id);
    if (!result.ok) {
      return { ok: false, error: { message: 'Failed to fetch updated verse' } };
    }

    return { ok: true, data: result.data };
  } catch {
    return { ok: false, error: { message: 'Failed to update translated verse' } };
  }
}

export async function upsertTranslatedVerse(
  input: CreateTranslatedVerseInput
): Promise<Result<TranslatedVerse>> {
  try {
    const [verse] = await db
      .insert(translated_verses)
      .values(input)
      .onConflictDoUpdate({
        target: [translated_verses.projectUnitId, translated_verses.bibleTextId],
        set: {
          content: sql`excluded.content`,
          assignedUserId: sql`excluded.assigned_user_id`,
        },
      })
      .returning();

    const result = await getTranslatedVerseById(verse.id);
    if (!result.ok) {
      return { ok: false, error: { message: 'Failed to fetch upserted verse' } };
    }

    return { ok: true, data: result.data };
  } catch {
    return { ok: false, error: { message: 'Failed to upsert translated verse' } };
  }
}

export async function listTranslatedVerses(
  filters: TranslatedVersesFilters = {}
): Promise<Result<TranslatedVerse[]>> {
  try {
    const conditions = [] as any[];
    if (filters.projectUnitId !== undefined) {
      conditions.push(eq(translated_verses.projectUnitId, filters.projectUnitId));
    }
    if (filters.bookId !== undefined) {
      conditions.push(eq(bible_texts.bookId, filters.bookId));
    }
    if (filters.chapterNumber !== undefined) {
      conditions.push(eq(bible_texts.chapterNumber, filters.chapterNumber));
    }
    const baseQuery = db
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
      .innerJoin(bible_texts, eq(translated_verses.bibleTextId, bible_texts.id));
    const verses =
      conditions.length > 0
        ? await baseQuery
            .where(and(...conditions))
            .orderBy(bible_texts.bookId, bible_texts.chapterNumber, bible_texts.verseNumber)
        : await baseQuery.orderBy(
            bible_texts.bookId,
            bible_texts.chapterNumber,
            bible_texts.verseNumber
          );
    return { ok: true, data: verses };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch translated verses' } };
  }
}
