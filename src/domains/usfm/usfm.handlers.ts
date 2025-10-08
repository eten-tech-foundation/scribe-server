import type { Readable } from 'node:stream';

import archiver from 'archiver';
import { and, asc, count, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import {
  bible_texts,
  books,
  project_unit_bible_books,
  project_units,
  projects,
  translated_verses,
} from '@/db/schema';

interface BookUSFMData {
  bookId: number;
  bookCode: string;
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
  text: string;
}

function sanitizeFilename(name: string): string {
  return name.trim().replace(/[<>:"/\\|?*]/g, '_');
}

async function getProjectBooks(projectUnitId: number, bookIds?: number[]) {
  const conditions = [eq(project_unit_bible_books.projectUnitId, projectUnitId)];

  if (bookIds?.length) {
    conditions.push(inArray(project_unit_bible_books.bookId, bookIds));
  }

  return db
    .select({
      bibleId: project_unit_bible_books.bibleId,
      bookId: project_unit_bible_books.bookId,
    })
    .from(project_unit_bible_books)
    .where(and(...conditions));
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

export async function generateProjectUSFM(
  projectUnitId: number,
  bookIds?: number[]
): Promise<Map<string, string>> {
  const projectBooks = await getProjectBooks(projectUnitId, bookIds);

  if (projectBooks.length === 0) {
    throw new Error(`No books found for project unit: ${projectUnitId}`);
  }

  const bookIdsSet = new Set(projectBooks.map((pb) => pb.bookId));
  const bibleIdsSet = new Set(projectBooks.map((pb) => pb.bibleId));

  const [bibleTexts, translatedVerses] = await Promise.all([
    db
      .select({
        id: bible_texts.id,
        bookId: bible_texts.bookId,
        bookCode: books.code,
        bookName: books.eng_display_name,
        chapterNumber: bible_texts.chapterNumber,
        verseNumber: bible_texts.verseNumber,
      })
      .from(bible_texts)
      .innerJoin(books, eq(bible_texts.bookId, books.id))
      .where(
        and(
          inArray(bible_texts.bibleId, [...bibleIdsSet]),
          inArray(bible_texts.bookId, [...bookIdsSet])
        )
      )
      .orderBy(
        asc(bible_texts.bookId),
        asc(bible_texts.chapterNumber),
        asc(bible_texts.verseNumber)
      ),
    db
      .select({
        bibleTextId: translated_verses.bibleTextId,
        content: translated_verses.content,
      })
      .from(translated_verses)
      .where(eq(translated_verses.projectUnitId, projectUnitId)),
  ]);

  if (bibleTexts.length === 0) {
    throw new Error(`No bible texts found for project unit: ${projectUnitId}`);
  }

  const translationMap = new Map(translatedVerses.map((tv) => [tv.bibleTextId, tv.content]));

  const bookDataMap = new Map<number, BookUSFMData[]>();

  for (const verse of bibleTexts) {
    const bookData: BookUSFMData = {
      bookId: verse.bookId,
      bookCode: verse.bookCode,
      bookName: verse.bookName,
      chapterNumber: verse.chapterNumber,
      verseNumber: verse.verseNumber,
      text: translationMap.get(verse.id) ?? '',
    };

    const verses = bookDataMap.get(verse.bookId) ?? [];
    verses.push(bookData);
    bookDataMap.set(verse.bookId, verses);
  }

  const usfmMap = new Map<string, string>();

  for (const verses of bookDataMap.values()) {
    if (verses.length > 0) {
      usfmMap.set(verses[0].bookCode, generateBookUSFM(verses));
    }
  }

  return usfmMap;
}

function generateBookUSFM(verses: BookUSFMData[]): string {
  if (verses.length === 0) return '';

  const { bookCode, bookName } = verses[0];
  const lines = [`\\id ${bookCode}`, `\\h ${bookName}`, `\\mt ${bookName}`];

  let currentChapter: number | null = null;

  for (const verse of verses) {
    if (currentChapter !== verse.chapterNumber) {
      lines.push(`\\c ${verse.chapterNumber}`, '\\p');
      currentChapter = verse.chapterNumber;
    }
    lines.push(`\\v ${verse.verseNumber} ${verse.text}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function createUSFMZipStream(bookUSFMMap: Map<string, string>): Readable {
  const archive = archiver('zip', { zlib: { level: 9 } });

  for (const [bookCode, usfmContent] of bookUSFMMap.entries()) {
    archive.append(usfmContent, { name: `${bookCode}.usfm` });
  }

  archive.finalize();
  return archive;
}

export async function getAvailableBooksForExport(projectUnitId: number) {
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

export async function exportProjectUSFMHandler(c: any) {
  try {
    const projectUnitId = Number.parseInt(c.req.param('projectUnitId'));

    if (Number.isNaN(projectUnitId)) {
      return c.json({ error: 'Invalid project unit ID' }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const { bookIds } = body;

    if (
      bookIds !== undefined &&
      (!Array.isArray(bookIds) || bookIds.some((id) => typeof id !== 'number'))
    ) {
      return c.json({ error: 'Invalid bookIds format. Expected array of numbers.' }, 400);
    }

    const projectName = await getProjectName(projectUnitId);

    if (!projectName) {
      return c.json({ error: 'Project not found for this project unit' }, 404);
    }

    const bookUSFMMap = await generateProjectUSFM(projectUnitId, bookIds);
    const zipStream = createUSFMZipStream(bookUSFMMap);
    const filename = `${sanitizeFilename(projectName)}.zip`;

    c.header('Content-Type', 'application/zip');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);

    return c.body(zipStream as any);
  } catch (error: any) {
    console.error('USFM Export Error:', error);
    return c.json(
      {
        error: 'Failed to export USFM',
        details: error.message,
      },
      500
    );
  }
}

export async function getExportableBooksHandler(c: any) {
  try {
    const projectUnitId = Number.parseInt(c.req.param('projectUnitId'));

    if (Number.isNaN(projectUnitId)) {
      return c.json({ error: 'Invalid project unit ID' }, 400);
    }

    const books = await getAvailableBooksForExport(projectUnitId);

    return c.json({
      projectUnitId,
      books,
      totalBooks: books.length,
    });
  } catch (error: any) {
    console.error('Get Exportable Books Error:', error);
    return c.json(
      {
        error: 'Failed to get exportable books',
        details: error.message,
      },
      500
    );
  }
}
