import { ilike, inArray, or } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { language_bcp_codes } from '@/db/schema';
import { withDatabaseRetry } from '@/lib/db-retry';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type { LanguageBcpCode } from './bcp-lookup.types';

/**
 * Return rows matching ANY of the provided language name patterns.
 * Each name is matched with ILIKE (partial, case-insensitive).
 */
export async function findByLanguageNames(names: string[]): Promise<Result<LanguageBcpCode[]>> {
  try {
    const conditions = names.map((n) => ilike(language_bcp_codes.languageName, `%${n.trim()}%`));
    const rows = await withDatabaseRetry(() =>
      db
        .select()
        .from(language_bcp_codes)
        .where(or(...conditions))
        .limit(200)
    );
    return ok(rows);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to search by language names',
      context: { names },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

/**
 * Return rows matching ANY of the provided ISO codes (exact match on
 * iso639_3 OR iso639_1 for each code).
 */
export async function findByIsoCodes(codes: string[]): Promise<Result<LanguageBcpCode[]>> {
  try {
    const trimmed = codes.map((c) => c.trim()).filter(Boolean);

    const rows = await withDatabaseRetry(() =>
      db
        .select()
        .from(language_bcp_codes)
        .where(
          or(
            inArray(language_bcp_codes.iso6393Code, trimmed),
            inArray(language_bcp_codes.iso6391Code, trimmed)
          )
        )
    );
    return ok(rows);
  } catch (error) {
    logger.error({ cause: error, message: 'Failed to search by ISO codes', context: { codes } });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
