import { eq } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { languages } from '@/db/schema';
import { err, ErrorCode, ok } from '@/lib/types';

import type { Language } from './languages.types';

export async function getAll(): Promise<Result<Language[]>> {
  try {
    const languageList = await db.select().from(languages);
    return ok(languageList);
  } catch {
    return err(ErrorCode.LANGUAGE_ERROR);
  }
}

export async function getById(id: number): Promise<Result<Language>> {
  try {
    const [language] = await db.select().from(languages).where(eq(languages.id, id));

    if (!language) {
      return err(ErrorCode.NOT_FOUND);
    }

    return ok(language);
  } catch {
    return err(ErrorCode.LANGUAGE_ERROR);
  }
}
