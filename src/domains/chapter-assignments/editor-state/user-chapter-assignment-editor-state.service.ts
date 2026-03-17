import type { UpsertEditorStateInput } from './user-chapter-assignment-editor-state.types';

import * as repo from './user-chapter-assignment-editor-state.repository';

export function getEditorState(userId: number, chapterAssignmentId: number) {
  return repo.findByUserAndAssignment(userId, chapterAssignmentId);
}

export function upsertEditorState(input: UpsertEditorStateInput) {
  return repo.upsert(input);
}
