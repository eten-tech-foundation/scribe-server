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

  // Exact match precedence logic
  const lowerTerms = languageTerms.map((t) => t.toLowerCase());
  const exactMatchNames = new Set(
    merged
      .filter((row) => lowerTerms.includes(row.languageName.toLowerCase()))
      .map((row) => row.languageName.toLowerCase())
  );

  const finalResults = merged.filter((row) => {
    const rowName = row.languageName.toLowerCase();

    // Always keep exact matches or rows found via ISO code (exact by definition)
    if (lowerTerms.includes(rowName) || isoCodes.length > 0) {
      return true;
    }

    // This is a partial match. Find which terms it matched.
    const matchedTerms = lowerTerms.filter((t) => rowName.includes(t));

    // Keep it ONLY if it partially matches a term that DOES NOT have an exact match.
    // If every term it matched already has a perfect exact match, discard this noise.
    return matchedTerms.some((t) => !exactMatchNames.has(t));
  });

  return ok(finalResults.map(toResponse));
}
