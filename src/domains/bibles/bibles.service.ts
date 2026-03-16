import { ok } from '@/lib/types';

import type { Bible, BibleResponse, CreateBible, UpdateBible } from './bibles.types';

import * as repo from './bibles.repository';

// ─── Response mapping ─────────────────────────────────────────────────────────

export function toResponse(bible: Bible): BibleResponse {
  return {
    id: bible.id,
    name: bible.name,
    abbreviation: bible.abbreviation,
    languageId: bible.languageId,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getAllBibles() {
  const result = await repo.getAll();
  if (!result.ok) return result;
  return ok(result.data.map(toResponse));
}

export async function getBibleById(id: number) {
  const result = await repo.getById(id);
  if (!result.ok) return result;
  return ok(toResponse(result.data));
}

export async function getBiblesByLanguageId(languageId: number) {
  const result = await repo.getByLanguageId(languageId);
  if (!result.ok) return result;
  return ok(result.data.map(toResponse));
}

export async function createBible(data: CreateBible) {
  const result = await repo.create(data);
  if (!result.ok) return result;
  return ok(toResponse(result.data));
}

export async function updateBible(id: number, data: UpdateBible) {
  const result = await repo.update(id, data);
  if (!result.ok) return result;
  return ok(toResponse(result.data));
}

export function deleteBible(id: number) {
  return repo.remove(id);
}
