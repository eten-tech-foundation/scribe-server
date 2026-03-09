import type { Result } from '@/lib/types';

import type {
  BibleBook,
  BibleBookWithDetails,
  CreateBibleBookInput,
  UpdateBibleBookInput,
} from './bible-books.types';

import * as bibleBooksRepo from './bible-books.repository';

export async function getBibleBooksByBibleId(
  bibleId: number
): Promise<Result<BibleBookWithDetails[]>> {
  return bibleBooksRepo.getByBibleId(bibleId);
}

export async function getBibleBookByBibleIdAndBookId(
  bibleId: number,
  bookId: number
): Promise<Result<BibleBookWithDetails>> {
  return bibleBooksRepo.getByBibleIdAndBookId(bibleId, bookId);
}

export async function createBibleBook(input: CreateBibleBookInput): Promise<Result<BibleBook>> {
  // Future: validate that bible and book both exist in a single pre-check, etc.
  return bibleBooksRepo.create(input);
}

export async function updateBibleBook(
  bibleId: number,
  bookId: number,
  input: UpdateBibleBookInput
): Promise<Result<BibleBook>> {
  return bibleBooksRepo.update(bibleId, bookId, input);
}

export async function deleteBibleBook(
  bibleId: number,
  bookId: number
): Promise<Result<{ bibleId: number; bookId: number }>> {
  return bibleBooksRepo.remove(bibleId, bookId);
}
