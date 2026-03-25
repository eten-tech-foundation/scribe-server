import { ok } from '@/lib/types';

import type { UpsertEditorStateInput } from './user-chapter-assignment-editor-state.types';

import * as repo from './user-chapter-assignment-editor-state.repository';

export async function getEditorState(userId: number, chapterAssignmentId: number) {
  const result = await repo.findByUserAndAssignment(userId, chapterAssignmentId);
  if (!result.ok) return result;
  return ok(result.data);
}

export async function upsertEditorState(input: UpsertEditorStateInput) {
  const result = await repo.upsert(input);
  if (!result.ok) return result;
  return ok(result.data);
}
