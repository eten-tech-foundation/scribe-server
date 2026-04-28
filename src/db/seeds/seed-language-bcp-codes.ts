/**
 * Seed script: populate language_bcp_codes from src/data/languages.csv
 *
 * Run with:
 *   npx tsx src/db/seeds/seed-language-bcp-codes.ts
 */

import fs from 'node:fs';
import path from 'node:path';

import { db } from '@/db';
import { language_bcp_codes } from '@/db/schema';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Parse the CSV manually to avoid an extra dependency
// ---------------------------------------------------------------------------

interface CsvRow {
  languageName: string;
  bcp47Code: string | null;
  iso6393Code: string | null;
  iso6391Code: string | null;
}

function parseLanguagesCsv(filePath: string): CsvRow[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');

  const rows: CsvRow[] = [];

  // Skip header (line 0): language,BCP-47 code,ISO 639-3 code,ISO 639-1 code
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields (e.g.  "Ayta, Abellen",abp_Latn,abp,)
    const cols = parseCsvLine(line);
    if (cols.length < 3) continue;

    const languageName = cols[0].trim();
    if (!languageName) continue;

    rows.push({
      languageName,
      bcp47Code: nullIfEmpty(cols[1]),
      iso6393Code: nullIfEmpty(cols[2]),
      iso6391Code: nullIfEmpty(cols[3]),
    });
  }

  return rows;
}

function nullIfEmpty(val: string | undefined): string | null {
  if (val === undefined) return null;
  const trimmed = val.trim();
  return trimmed === '' ? null : trimmed;
}

/** Minimal RFC 4180-compatible CSV line parser */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const csvPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../../data/languages.csv'
  );

  logger.info({ path: csvPath }, 'Reading languages.csv');
  const rows = parseLanguagesCsv(csvPath);
  logger.info({ count: rows.length }, 'Parsed rows from CSV');

  // Idempotent: truncate first (hackathon-friendly approach)
  await db.delete(language_bcp_codes);
  logger.info('Cleared existing language_bcp_codes rows');

  // Bulk insert in chunks to stay within PG limits
  const CHUNK_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await db.insert(language_bcp_codes).values(chunk);
    inserted += chunk.length;
    logger.info({ inserted, total: rows.length }, 'Inserting chunk');
  }

  logger.info({ inserted }, 'Done seeding language_bcp_codes');
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
