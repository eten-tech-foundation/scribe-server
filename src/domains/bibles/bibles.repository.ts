import { eq } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { bibles } from '@/db/schema';
import { err, ErrorCode, ok } from '@/lib/types';

import type { Bible, CreateBible, UpdateBible } from './bibles.types';

export async function getAll(): Promise<Result<Bible[]>> {
  try {
    return ok(await db.select().from(bibles));
  } catch {
    return err('Failed to fetch bibles', ErrorCode.INTERNAL_ERROR);
  }
}

export async function getById(id: number): Promise<Result<Bible>> {
  try {
    const [bible] = await db.select().from(bibles).where(eq(bibles.id, id)).limit(1);
    if (!bible) return err('Bible not found', ErrorCode.BIBLE_NOT_FOUND);
    return ok(bible);
  } catch {
    return err('Failed to fetch bible', ErrorCode.INTERNAL_ERROR);
  }
}

export async function getByLanguageId(languageId: number): Promise<Result<Bible[]>> {
  try {
    return ok(await db.select().from(bibles).where(eq(bibles.languageId, languageId)));
  } catch {
    return err('Failed to fetch bibles for language', ErrorCode.INTERNAL_ERROR);
  }
}

export async function create(data: CreateBible): Promise<Result<Bible>> {
  try {
    const [bible] = await db.insert(bibles).values(data).returning();
    if (!bible) return err('Failed to create bible', ErrorCode.INTERNAL_ERROR);
    return ok(bible);
  } catch {
    return err('Failed to create bible', ErrorCode.INTERNAL_ERROR);
  }
}

export async function update(id: number, data: UpdateBible): Promise<Result<Bible>> {
  try {
    const [bible] = await db.update(bibles).set(data).where(eq(bibles.id, id)).returning();
    if (!bible) return err('Bible not found', ErrorCode.BIBLE_NOT_FOUND);
    return ok(bible);
  } catch {
    return err('Failed to update bible', ErrorCode.INTERNAL_ERROR);
  }
}

export async function remove(id: number): Promise<Result<{ id: number }>> {
  try {
    const [deleted] = await db.delete(bibles).where(eq(bibles.id, id)).returning({ id: bibles.id });
    if (!deleted) return err('Bible not found', ErrorCode.BIBLE_NOT_FOUND);
    return ok(deleted);
  } catch {
    return err('Failed to delete bible', ErrorCode.INTERNAL_ERROR);
  }
}
