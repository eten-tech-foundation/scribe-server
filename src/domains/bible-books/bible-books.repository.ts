import { and, eq } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { bible_books, bibles, books } from '@/db/schema';
import { err, ErrorCode, ok } from '@/lib/types';

import type { BibleBook, BibleBookWithDetails, CreateBibleBookInput } from './bible-books.types';

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

export async function getByBibleId(bibleId: number): Promise<Result<BibleBookWithDetails[]>> {
  try {
    const bibleBookList = await db
      .select(bibleBookSelect)
      .from(bible_books)
      .innerJoin(books, eq(bible_books.bookId, books.id))
      .innerJoin(bibles, eq(bible_books.bibleId, bibles.id))
      .where(eq(bible_books.bibleId, bibleId));

    return ok(bibleBookList);
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function getByBibleIdAndBookId(
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

    if (!bibleBook) return err(ErrorCode.BIBLE_BOOK_NOT_FOUND);
    return ok(bibleBook);
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function create(input: CreateBibleBookInput): Promise<Result<BibleBook>> {
  try {
    const [bibleBook] = await db.insert(bible_books).values(input).returning();
    if (!bibleBook) return err(ErrorCode.INTERNAL_ERROR);
    return ok(bibleBook);
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return err(ErrorCode.DUPLICATE);
    }
    if (error instanceof Error && error.message.includes('foreign key constraint')) {
      return err(ErrorCode.INVALID_REFERENCE);
    }
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function remove(bibleId: number, bookId: number): Promise<Result<void>> {
  try {
    const [deleted] = await db
      .delete(bible_books)
      .where(and(eq(bible_books.bibleId, bibleId), eq(bible_books.bookId, bookId)))
      .returning({ bibleId: bible_books.bibleId });

    if (!deleted) return err(ErrorCode.BIBLE_BOOK_NOT_FOUND);
    return ok(undefined);
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
