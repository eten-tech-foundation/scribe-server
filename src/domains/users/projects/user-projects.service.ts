import { ok } from '@/lib/types';

import type { ProjectWithLanguageNames, UserProjectResponse } from './user-projects.types';

import * as repo from './user-projects.repository';

// ─── Response mapper ──────────────────────────────────────────────────────────
export function toUserProjectResponse(project: ProjectWithLanguageNames): UserProjectResponse {
  return project;
}

// ─── Service functions ────────────────────────────────────────────────────────
export async function getProjectsByUserId(userId: number) {
  const result = await repo.findByUserId(userId);
  if (!result.ok) return result;
  return ok(result.data.map(toUserProjectResponse));
}
