import * as repo from './bible-texts.repository';

export function getBibleTextsByChapter(bibleId: number, bookId: number, chapterNumber: number) {
  return repo.getByChapter(bibleId, bookId, chapterNumber);
}
