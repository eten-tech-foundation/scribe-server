import { ok } from '@/lib/types';

import type { BcpLookupQuery, BcpLookupResponse, LanguageBcpCode } from './bcp-lookup.types';

import * as repo from './bcp-lookup.repository';

function toResponse(row: LanguageBcpCode): BcpLookupResponse {
  return {
    id: row.id,
    languageName: row.languageName,
    bcp47Code: row.bcp47Code,
    iso6393Code: row.iso6393Code,
    iso6391Code: row.iso6391Code,
  };
}

/** Parse a comma-separated string into a non-empty trimmed array. */
function splitCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function lookupBcp(query: BcpLookupQuery) {
  const languageTerms = splitCsv(query.language);
  const isoCodes = splitCsv(query.iso);

  // Fan out both queries in parallel, only execute the ones that have values
  const [langResult, isoResult] = await Promise.all([
    languageTerms.length > 0 ? repo.findByLanguageNames(languageTerms) : null,
    isoCodes.length > 0 ? repo.findByIsoCodes(isoCodes) : null,
  ]);

  if (langResult && !langResult.ok) return langResult;
  if (isoResult && !isoResult.ok) return isoResult;

  // Union results, deduplicate by id
  const seen = new Set<number>();
  const merged: LanguageBcpCode[] = [];

  for (const row of [...(langResult?.data ?? []), ...(isoResult?.data ?? [])]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row);
    }
  }

  return ok(merged.map(toResponse));
}
