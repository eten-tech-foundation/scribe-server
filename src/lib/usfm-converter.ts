import usfmGrammar from 'usfm-grammar';

import { logger } from '@/lib/logger';
const { USFMParser } = usfmGrammar;

interface VerseData {
  bookId: number;
  bookCode: string;
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
  translatedContent: string | null;
}

function convertUSFMToUSJ(usfmText: string): any {
  try {
    const parser = new USFMParser(usfmText);

    // Check for errors
    if (parser.errors && parser.errors.length > 0) {
      logger.warn('USFM parser warnings:', { errors: parser.errors });
    }

    return parser.toUSJ();
  } catch (error) {
    logger.error('Error converting USFM to USJ:', error);
    throw error;
  }
}

function generateUSFMText(verses: VerseData[]): string {
  if (verses.length === 0) {
    return '';
  }

  const { bookCode, bookName } = verses[0];
  let usfmText = `\\id ${bookCode}\n\\h ${bookName}\n\\mt ${bookName}\n`;

  let currentChapter: number | null = null;

  for (const verse of verses) {
    if (currentChapter !== verse.chapterNumber) {
      usfmText += `\\c ${verse.chapterNumber}\n\\p\n`;
      currentChapter = verse.chapterNumber;
    }
    usfmText += `\\v ${verse.verseNumber} ${verse.translatedContent ?? ''}\n`;
  }

  return `${usfmText}\n`;
}

export { convertUSFMToUSJ, generateUSFMText };
