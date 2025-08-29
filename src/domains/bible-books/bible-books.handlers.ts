import type { z } from '@hono/zod-openapi';

import { and, eq } from 'drizzle-orm';

import type { selectBibleBooksSchema } from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import { bible_books, bibles, books } from '@/db/schema';

export type BibleBook = z.infer<typeof selectBibleBooksSchema>;

export interface BibleBookWithDetails extends BibleBook {
  book: {
    id: number;
    code: string;
    eng_display_name: string;
  };
  bible: {
    id: number;
    name: string;
  };
}

export interface CreateBibleBookInput {
  bibleId: number;
  bookId: number;
}

export interface UpdateBibleBookInput {
  bibleId: number;
  bookId: number;
  updatedAt?: Date;
}

const bibleBookSelect = {
  bibleId: bible_books.bibleId,
  bookId: bible_books.bookId,
  createdAt: bible_books.createdAt,
  updatedAt: bible_books.updatedAt,
  book: {
    id: books.id,
    code: books.code,
    eng_display_name: books.eng_display_name,
  },
  bible: {
    id: bibles.id,
    name: bibles.name,
  },
};

export async function getBibleBooksByBibleId(
  bibleId: number
): Promise<Result<BibleBookWithDetails[]>> {
  try {
    const bibleBookList = await db
      .select(bibleBookSelect)
      .from(bible_books)
      .innerJoin(books, eq(bible_books.bookId, books.id))
      .innerJoin(bibles, eq(bible_books.bibleId, bibles.id))
      .where(eq(bible_books.bibleId, bibleId));

    return bibleBookList.length > 0
      ? { ok: true, data: bibleBookList }
      : { ok: false, error: { message: 'No Bible Books found for this bible' } };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch bible books' } };
  }
}

export async function getBibleBookByBibleIdAndBookId(
  bibleId: number,
  bookId: number
): Promise<Result<BibleBookWithDetails>> {
  try {
    const [bibleBook] = await db
      .select(bibleBookSelect)
      .from(bible_books)
      .innerJoin(books, eq(bible_books.bookId, books.id))
      .innerJoin(bibles, eq(bible_books.bibleId, bibles.id))
      .where(and(eq(bible_books.bibleId, bibleId), eq(bible_books.bookId, bookId)))
      .limit(1);

    if (!bibleBook) {
      return { ok: false, error: { message: 'Bible Book not found' } };
    }

    return { ok: true, data: bibleBook };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch bible book' } };
  }
}

export async function createBibleBook(input: CreateBibleBookInput): Promise<Result<BibleBook>> {
  try {
    const [bibleBook] = await db.insert(bible_books).values(input).returning();

    if (!bibleBook) {
      return { ok: false, error: { message: 'Unable to create bible book' } };
    }

    return { ok: true, data: bibleBook };
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return { ok: false, error: { message: 'Bible book already exists' } };
    }
    if (error instanceof Error && error.message.includes('FOREIGN KEY constraint failed')) {
      return { ok: false, error: { message: 'Invalid bible or book reference' } };
    }

    return { ok: false, error: { message: 'Failed to create bible book' } };
  }
}

export async function updateBibleBook(
  bibleId: number,
  bookId: number,
  input: UpdateBibleBookInput
): Promise<Result<BibleBook>> {
  try {
    const [updated] = await db
      .update(bible_books)
      .set(input)
      .where(and(eq(bible_books.bibleId, bibleId), eq(bible_books.bookId, bookId)))
      .returning();

    if (!updated) {
      return { ok: false, error: { message: 'Bible book not found' } };
    }

    return { ok: true, data: updated };
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return { ok: false, error: { message: 'Bible book already exists with these identifiers' } };
    }
    if (error instanceof Error && error.message.includes('FOREIGN KEY constraint failed')) {
      return { ok: false, error: { message: 'Invalid bible or book reference' } };
    }

    return { ok: false, error: { message: 'Failed to update bible book' } };
  }
}

export async function deleteBibleBook(bibleId: number, bookId: number): Promise<Result<boolean>> {
  try {
    const result = await db
      .delete(bible_books)
      .where(and(eq(bible_books.bibleId, bibleId), eq(bible_books.bookId, bookId)))
      .returning({ bibleId: bible_books.bibleId, bookId: bible_books.bookId });

    if (result.length === 0) {
      return { ok: false, error: { message: 'Bible book not found' } };
    }

    return { ok: true, data: true };
  } catch {
    return { ok: false, error: { message: 'Failed to delete bible book' } };
  }
}
