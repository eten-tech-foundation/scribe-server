import { eq } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { languages } from '@/db/schema';
import { err, ErrorCode, ok } from '@/lib/types';

import type { Language } from './languages.types';

export async function getAll(): Promise<Result<Language[]>> {
  try {
    return ok(await db.select().from(languages));
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function getById(id: number): Promise<Result<Language>> {
  try {
    const [language] = await db.select().from(languages).where(eq(languages.id, id));

    if (!language) return err(ErrorCode.LANGUAGE_NOT_FOUND);
    return ok(language);
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
