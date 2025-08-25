import type { z } from '@hono/zod-openapi';

import { eq } from 'drizzle-orm';

import type { insertBiblesSchema, patchBiblesSchema, selectBiblesSchema } from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import { bibles } from '@/db/schema';

export type Bible = z.infer<typeof selectBiblesSchema>;
export type CreateBible = z.infer<typeof insertBiblesSchema>;
export type UpdateBible = z.infer<typeof patchBiblesSchema>;

export async function getAllBibles(): Promise<Result<Bible[]>> {
  try {
    const bibleList = await db.select().from(bibles);
    return { ok: true, data: bibleList };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch bibles' } };
  }
}

export async function getBibleById(id: number): Promise<Result<Bible>> {
  try {
    const bible = await db.select().from(bibles).where(eq(bibles.id, id));

    if (bible.length === 0) {
      return { ok: false, error: { message: 'Bible not found' } };
    }

    return { ok: true, data: bible[0] };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch bible' } };
  }
}

export async function createBible(bibleData: CreateBible): Promise<Result<Bible>> {
  try {
    const newBible = await db.insert(bibles).values(bibleData).returning();
    return { ok: true, data: newBible[0] };
  } catch {
    return { ok: false, error: { message: 'Failed to create bible' } };
  }
}

export async function updateBible(id: number, bibleData: UpdateBible): Promise<Result<Bible>> {
  try {
    const updatedBible = await db
      .update(bibles)
      .set(bibleData)
      .where(eq(bibles.id, id))
      .returning();

    if (updatedBible.length === 0) {
      return { ok: false, error: { message: 'Bible not found' } };
    }

    return { ok: true, data: updatedBible[0] };
  } catch {
    return { ok: false, error: { message: 'Failed to update bible' } };
  }
}

export async function deleteBible(id: number): Promise<Result<{ message: string }>> {
  try {
    const deletedBible = await db.delete(bibles).where(eq(bibles.id, id)).returning();

    if (deletedBible.length === 0) {
      return { ok: false, error: { message: 'Bible not found' } };
    }

    return { ok: true, data: { message: 'Bible deleted successfully' } };
  } catch {
    return { ok: false, error: { message: 'Failed to delete bible' } };
  }
}
