import type { z } from '@hono/zod-openapi';

import { eq, inArray, sql } from 'drizzle-orm';

import type { selectBooksSchema } from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import { books } from '@/db/schema';

export type Book = z.infer<typeof selectBooksSchema>;

// Old Testament books codes (39 books)
const OLD_TESTAMENT_CODES = [
  'GEN',
  'EXO',
  'LEV',
  'NUM',
  'DEU',
  'JOS',
  'JDG',
  'RUT',
  '1SA',
  '2SA',
  '1KI',
  '2KI',
  '1CH',
  '2CH',
  'EZR',
  'NEH',
  'EST',
  'JOB',
  'PSA',
  'PRO',
  'ECC',
  'SNG',
  'ISA',
  'JER',
  'LAM',
  'EZK',
  'DAN',
  'HOS',
  'JOL',
  'AMO',
  'OBA',
  'JON',
  'MIC',
  'NAM',
  'HAB',
  'ZEP',
  'HAG',
  'ZEC',
  'MAL',
];

// New Testament books codes (27 books)
const NEW_TESTAMENT_CODES = [
  'MAT',
  'MRK',
  'LUK',
  'JHN',
  'ACT',
  'ROM',
  '1CO',
  '2CO',
  'GAL',
  'EPH',
  'PHP',
  'COL',
  '1TH',
  '2TH',
  '1TI',
  '2TI',
  'TIT',
  'PHM',
  'HEB',
  'JAS',
  '1PE',
  '2PE',
  '1JN',
  '2JN',
  '3JN',
  'JUD',
  'REV',
];

export async function getAllBooks(): Promise<Result<Book[]>> {
  try {
    const bookList = await db.select().from(books);
    return { ok: true, data: bookList };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch books' } };
  }
}

export async function getBookById(id: number): Promise<Result<Book>> {
  try {
    const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);

    if (!book) {
      return { ok: false, error: { message: 'Book not found' } };
    }

    return { ok: true, data: book };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch book' } };
  }
}

export async function getBookByCode(code: string): Promise<Result<Book>> {
  try {
    const [book] = await db
      .select()
      .from(books)
      .where(sql`UPPER(${books.code}) = UPPER(${code})`)
      .limit(1);

    if (!book) {
      return { ok: false, error: { message: 'Book not found' } };
    }

    return { ok: true, data: book };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch book' } };
  }
}

export async function getOldTestamentBooks(): Promise<Result<Book[]>> {
  try {
    const bookList = await db.select().from(books).where(inArray(books.code, OLD_TESTAMENT_CODES));
    return { ok: true, data: bookList };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch Old Testament books' } };
  }
}

export async function getNewTestamentBooks(): Promise<Result<Book[]>> {
  try {
    const bookList = await db.select().from(books).where(inArray(books.code, NEW_TESTAMENT_CODES));
    return { ok: true, data: bookList };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch New Testament books' } };
  }
}
