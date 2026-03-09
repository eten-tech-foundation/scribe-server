import type { Result } from '@/lib/types';

import type { Book } from './books.types';

import * as booksRepo from './books.repository';

export async function getAllBooks(): Promise<Result<Book[]>> {
  return booksRepo.getAll();
}

export async function getBookById(id: number): Promise<Result<Book>> {
  return booksRepo.getById(id);
}

export async function getBookByCode(code: string): Promise<Result<Book>> {
  return booksRepo.getByCode(code);
}

export async function getOldTestamentBooks(): Promise<Result<Book[]>> {
  return booksRepo.getOldTestament();
}

export async function getNewTestamentBooks(): Promise<Result<Book[]>> {
  return booksRepo.getNewTestament();
}
