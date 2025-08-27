import type { z } from '@hono/zod-openapi';

import { and, eq } from 'drizzle-orm';

import type { selectBibleBooksSchema } from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import { bible_books, bibles, books } from '@/db/schema';

export type BibleBook = z.infer<typeof selectBibleBooksSchema>;

export interface BibleBookWithDetails extends BibleBook {
  book?: {
    id: number;
    code: string;
    eng_display_name: string;
  };
  bible?: {
    id: number;
    name: string;
  };
}

export interface CreateBibleBookInput {
  bibleId: number;
  bookId: number;
}

export interface UpdateBibleBookInput {
  bibleId?: number;
  bookId?: number;
  updatedAt?: Date;
}

export async function getBibleBooksByBibleId(
  bibleId: number
): Promise<Result<BibleBookWithDetails[]>> {
  const rawBibleBookList = await db
    .select({
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
    })
    .from(bible_books)
    .leftJoin(books, eq(bible_books.bookId, books.id))
    .leftJoin(bibles, eq(bible_books.bibleId, bibles.id))
    .where(eq(bible_books.bibleId, bibleId));

  const bibleBookList = rawBibleBookList.map((item) => ({
    ...item,
    book: item.book || undefined,
    bible: item.bible || undefined,
  }));

  return bibleBookList.length > 0
    ? { ok: true, data: bibleBookList }
    : { ok: false, error: { message: 'No Bible Books found for this bible - or internal error' } };
}

export async function getBibleBookByBibleIdAndBookId(
  bibleId: number,
  bookId: number
): Promise<Result<BibleBookWithDetails>> {
  const [rawBibleBook] = await db
    .select({
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
    })
    .from(bible_books)
    .leftJoin(books, eq(bible_books.bookId, books.id))
    .leftJoin(bibles, eq(bible_books.bibleId, bibles.id))
    .where(and(eq(bible_books.bibleId, bibleId), eq(bible_books.bookId, bookId)))
    .limit(1);

  if (!rawBibleBook) {
    return { ok: false, error: { message: 'Bible Book not found' } };
  }

  const bibleBook = {
    ...rawBibleBook,
    book: rawBibleBook.book || undefined,
    bible: rawBibleBook.bible || undefined,
  };

  return { ok: true, data: bibleBook };
}

export async function createBibleBook(input: CreateBibleBookInput): Promise<Result<BibleBook>> {
  const [bibleBook] = await db.insert(bible_books).values(input).returning();

  return bibleBook
    ? { ok: true, data: bibleBook }
    : { ok: false, error: { message: 'Unable to create bible book' } };
}

export async function updateBibleBook(
  bibleId: number,
  bookId: number,
  input: UpdateBibleBookInput
): Promise<Result<BibleBook>> {
  const [updated] = await db
    .update(bible_books)
    .set(input)
    .where(and(eq(bible_books.bibleId, bibleId), eq(bible_books.bookId, bookId)))
    .returning();

  return updated
    ? { ok: true, data: updated }
    : { ok: false, error: { message: 'Cannot update bible book' } };
}

export async function deleteBibleBook(bibleId: number, bookId: number): Promise<Result<boolean>> {
  const result = await db
    .delete(bible_books)
    .where(and(eq(bible_books.bibleId, bibleId), eq(bible_books.bookId, bookId)))
    .returning({ bibleId: bible_books.bibleId, bookId: bible_books.bookId });

  return result.length > 0
    ? { ok: true, data: true }
    : { ok: false, error: { message: 'Cannot delete bible book' } };
}
