import type { z } from '@hono/zod-openapi';

import { eq } from 'drizzle-orm';

import type { selectLanguagesSchema } from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import { languages } from '@/db/schema';

export type Language = z.infer<typeof selectLanguagesSchema>;
export async function getAllLanguages(): Promise<Result<Language[]>> {
  try {
    const languageList = await db.select().from(languages);
    return { ok: true, data: languageList };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch languages' } };
  }
}

export async function getLanguageById(id: number): Promise<Result<Language>> {
  try {
    const [language] = await db.select().from(languages).where(eq(languages.id, id));

    if (!language) {
      return { ok: false, error: { message: 'Language not found' } };
    }

    return { ok: true, data: language };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch language' } };
  }
}
