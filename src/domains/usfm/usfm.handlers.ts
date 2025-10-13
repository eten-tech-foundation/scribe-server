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

async function getBookVerses(projectUnitId: number, bookId: number): Promise<VerseData[]> {
  const bibleIds = await db
    .selectDistinct({ bibleId: project_unit_bible_books.bibleId })
    .from(project_unit_bible_books)
    .where(
      and(
        eq(project_unit_bible_books.projectUnitId, projectUnitId),
        eq(project_unit_bible_books.bookId, bookId)
      )
    );

  if (bibleIds.length === 0) {
    return [];
  }

  const bibleIdArray = bibleIds.map((b) => b.bibleId);

  const query = db
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
    .where(and(inArray(bible_texts.bibleId, bibleIdArray), eq(bible_texts.bookId, bookId)))
    .orderBy(asc(bible_texts.chapterNumber), asc(bible_texts.verseNumber));

  return query;
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
      logger.warn('Archive warning:', { warning: err, projectUnitId });
    } else {
      hasError = true;
      logger.error('Archive critical warning:', { error: err, projectUnitId, bookIds });
    }
  });

  archive.on('end', () => {
    logger.info('Archive finalized successfully', { projectUnitId, bookIds });
  });

  const processData = async () => {
    for (const book of projectBooks) {
      if (hasError) {
        logger.warn('Stopping USFM generation due to error', { projectUnitId });
        break;
      }

      const verses = await getBookVerses(projectUnitId, book.bookId);

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

      await new Promise((resolve) => setImmediate(resolve));
    }

    if (!hasError) {
      await archive.finalize();
    }
  };

  processData().catch((error) => {
    hasError = true;
    logger.error('Error processing USFM stream:', { error, projectUnitId, bookIds });
    const err = error instanceof Error ? error : new Error('Unknown error');
    if (!archive.destroyed) {
      archive.destroy(err);
    }
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
