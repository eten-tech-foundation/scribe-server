import * as repo from './chapter-assignments-presence.repository';

export function registerPresenceAndCheck(userId: number, chapterAssignmentId: number) {
  return repo.upsertAndQueryFirstEditor(userId, chapterAssignmentId);
}

export function removePresence(userId: number, chapterAssignmentId: number) {
  return repo.deleteByUserAndAssignment(userId, chapterAssignmentId);
}
