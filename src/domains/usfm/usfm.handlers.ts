import archiver from 'archiver';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { Readable } from 'node:stream';

import { db } from '@/db';
import {
  bible_texts,
  books,
  project_unit_bible_books,
  project_units,
  projects,
  translated_verses,
} from '@/db/schema';
import { logger } from '@/lib/logger';

const MAX_COMPRESSION_LEVEL = 9;
const BATCH_SIZE = 25;

interface VerseData {
  bookId: number;
  bookCode: string;
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
  translatedContent: string | null;
}

interface BookInfo {
  bookId: number;
  bookCode: string;
  bookName: string;
}

interface ExportResult {
  stream: Readable;
  cleanup: () => void;
}

async function getProjectName(projectUnitId: number): Promise<string | null> {
  const result = await db
    .select({ name: projects.name })
    .from(projects)
    .innerJoin(project_units, eq(projects.id, project_units.projectId))
    .where(eq(project_units.id, projectUnitId))
    .limit(1);

  return result[0]?.name ?? null;
}

async function validateBookIds(projectUnitId: number, bookIds?: number[]): Promise<boolean> {
  if (!bookIds || bookIds.length === 0) {
    return true;
  }

  const validBooks = await db
    .selectDistinct({ bookId: project_unit_bible_books.bookId })
    .from(project_unit_bible_books)
    .where(
      and(
        eq(project_unit_bible_books.projectUnitId, projectUnitId),
        inArray(project_unit_bible_books.bookId, bookIds)
      )
    );

  return validBooks.length === bookIds.length;
}

async function getProjectBooks(projectUnitId: number, bookIds?: number[]): Promise<BookInfo[]> {
  const query = db
    .selectDistinct({
      bookId: project_unit_bible_books.bookId,
      bookCode: books.code,
      bookName: books.eng_display_name,
    })
    .from(project_unit_bible_books)
    .innerJoin(books, eq(project_unit_bible_books.bookId, books.id))
    .where(
      and(
        eq(project_unit_bible_books.projectUnitId, projectUnitId),
        ...(bookIds?.length ? [inArray(project_unit_bible_books.bookId, bookIds)] : [])
      )
    )
    .orderBy(asc(project_unit_bible_books.bookId));

  return query;
}

async function getBookVerses(
  projectUnitId: number,
  bookIds: number[]
): Promise<Map<number, VerseData[]>> {
  if (!bookIds || bookIds.length === 0) {
    return new Map();
  }

  const verses: VerseData[] = [];

  for (let i = 0; i < bookIds.length; i += BATCH_SIZE) {
    const batchBookIds = bookIds.slice(i, i + BATCH_SIZE);

    const batchVerses = await db
      .select({
        bookId: bible_texts.bookId,
        bookCode: books.code,
        bookName: books.eng_display_name,
        chapterNumber: bible_texts.chapterNumber,
        verseNumber: bible_texts.verseNumber,
        translatedContent: translated_verses.content,
      })
      .from(bible_texts)
      .innerJoin(books, eq(bible_texts.bookId, books.id))
      .innerJoin(
        project_unit_bible_books,
        and(
          eq(project_unit_bible_books.bookId, bible_texts.bookId),
          eq(project_unit_bible_books.bibleId, bible_texts.bibleId),
          eq(project_unit_bible_books.projectUnitId, projectUnitId)
        )
      )
      .leftJoin(
        translated_verses,
        and(
          eq(translated_verses.bibleTextId, bible_texts.id),
          eq(translated_verses.projectUnitId, projectUnitId)
        )
      )
      .where(
        and(
          eq(project_unit_bible_books.projectUnitId, projectUnitId),
          inArray(bible_texts.bookId, batchBookIds)
        )
      )
      .orderBy(
        asc(bible_texts.bookId),
        asc(bible_texts.chapterNumber),
        asc(bible_texts.verseNumber)
      );

    verses.push(...batchVerses);
  }

  const versesByBook = new Map<number, VerseData[]>();
  for (const verse of verses) {
    if (!versesByBook.has(verse.bookId)) {
      versesByBook.set(verse.bookId, []);
    }
    versesByBook.get(verse.bookId)!.push(verse);
  }

  return versesByBook;
}

function createUSFMStreamForBook(verses: VerseData[]): Readable {
  if (verses.length === 0) {
    return Readable.from([]);
  }

  const { bookCode, bookName } = verses[0];

  async function* generateUSFMChunks() {
    yield `\\id ${bookCode}\n`;
    yield `\\h ${bookName}\n`;
    yield `\\mt ${bookName}\n`;

    let currentChapter: number | null = null;

    for (const verse of verses) {
      if (currentChapter !== verse.chapterNumber) {
        yield `\\c ${verse.chapterNumber}\n\\p\n`;
        currentChapter = verse.chapterNumber;
      }
      yield `\\v ${verse.verseNumber} ${verse.translatedContent ?? ''}\n`;
    }

    yield '\n';
  }

  return Readable.from(generateUSFMChunks());
}

async function createUSFMZipStreamAsync(
  projectUnitId: number,
  bookIds?: number[]
): Promise<ExportResult | null> {
  const projectBooks = await getProjectBooks(projectUnitId, bookIds);

  if (projectBooks.length === 0) {
    logger.info('No books found for export', { projectUnitId, bookIds });
    return null;
  }

  const archive = archiver('zip', { zlib: { level: MAX_COMPRESSION_LEVEL } });
  let cleanupExecuted = false;
  let hasError = false;

  const cleanup = () => {
    if (cleanupExecuted) {
      return;
    }
    cleanupExecuted = true;

    if (!archive.destroyed) {
      archive.destroy();
    }
    logger.info('Archive cleanup executed', { projectUnitId, bookIds });
  };

  archive.on('error', (err) => {
    hasError = true;
    logger.error('Archive error:', { error: err, projectUnitId, bookIds });
  });

  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      logger.warn('Archive warning - file not found:', { warning: err, projectUnitId });
    } else {
      hasError = true;
      logger.error('Archive critical warning:', { error: err, projectUnitId, bookIds });
    }
  });

  archive.on('end', () => {
    logger.info('Archive finalized successfully', { projectUnitId, bookIds });
  });

  const processData = async () => {
    try {
      const bookIdArray = projectBooks.map((b) => b.bookId);
      const versesByBook = await getBookVerses(projectUnitId, bookIdArray);

      for (const book of projectBooks) {
        if (hasError) {
          logger.warn('Stopping USFM generation due to error', { projectUnitId });
          break;
        }

        const verses = versesByBook.get(book.bookId) ?? [];

        if (verses.length === 0) {
          logger.warn('No verses found for book', {
            projectUnitId,
            bookId: book.bookId,
            bookCode: book.bookCode,
          });
          continue;
        }

        const bookStream = createUSFMStreamForBook(verses);
        archive.append(bookStream, { name: `${book.bookCode}.usfm` });

        await new Promise((resolve) => process.nextTick(resolve));
      }

      if (!hasError) {
        await archive.finalize();
      } else {
        archive.destroy();
      }
    } catch (error) {
      hasError = true;
      logger.error('Error processing USFM stream:', { error, projectUnitId, bookIds });
      const err =
        error instanceof Error ? error : new Error('Unknown error during USFM generation');
      if (!archive.destroyed) {
        archive.destroy(err);
      }
    }
  };

  processData().catch((error) => {
    hasError = true;
    logger.error('Unhandled error in processData:', { error, projectUnitId, bookIds });
  });

  return { stream: archive, cleanup };
}

async function getAvailableBooksForExport(projectUnitId: number) {
  return db
    .select({
      bookId: project_unit_bible_books.bookId,
      bookCode: books.code,
      bookName: books.eng_display_name,
      verseCount: count(bible_texts.id).as('verse_count'),
      translatedCount: count(translated_verses.id).as('translated_count'),
    })
    .from(project_unit_bible_books)
    .innerJoin(books, eq(project_unit_bible_books.bookId, books.id))
    .innerJoin(
      bible_texts,
      and(
        eq(bible_texts.bibleId, project_unit_bible_books.bibleId),
        eq(bible_texts.bookId, project_unit_bible_books.bookId)
      )
    )
    .leftJoin(
      translated_verses,
      and(
        eq(translated_verses.bibleTextId, bible_texts.id),
        eq(translated_verses.projectUnitId, projectUnitId)
      )
    )
    .where(eq(project_unit_bible_books.projectUnitId, projectUnitId))
    .groupBy(project_unit_bible_books.bookId, books.code, books.eng_display_name)
    .orderBy(asc(project_unit_bible_books.bookId));
}

export { createUSFMZipStreamAsync, getAvailableBooksForExport, getProjectName, validateBookIds };
