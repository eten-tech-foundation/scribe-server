import type { BulkChapterRequest } from './bible-texts.types';

import * as repo from './bible-texts.repository';

export function getBibleTextsByChapter(bibleId: number, bookId: number, chapterNumber: number) {
  return repo.getByChapter(bibleId, bookId, chapterNumber);
}

export function getBulkBibleTexts(bibleId: number, body: BulkChapterRequest) {
  return repo.getByChapters(bibleId, body.chapters);
}
