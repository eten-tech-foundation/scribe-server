import { ok } from '@/lib/types';

import type { ProjectWithLanguageNames, UserProjectResponse } from './user-projects.types';

import * as repo from './user-projects.repository';

// ─── Response mapper ──────────────────────────────────────────────────────────
export function toUserProjectResponse(project: ProjectWithLanguageNames): UserProjectResponse {
  return {
    id: project.id,
    name: project.name,
    organization: project.organization,
    isActive: project.isActive,
    status: project.status,
    createdBy: project.createdBy,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    metadata: project.metadata as Record<string, unknown> | null | undefined,
    sourceLanguageId: project.sourceLanguageId,
    targetLanguageId: project.targetLanguageId,
    sourceLanguageName: project.sourceLanguageName,
    targetLanguageName: project.targetLanguageName,
    sourceName: project.sourceName,
    lastChapterActivity: project.lastChapterActivity,
    chapterStatusCounts: project.chapterStatusCounts,
    workflowConfig: project.workflowConfig,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────
export async function getProjectsByUserId(userId: number) {
  const result = await repo.findByUserId(userId);
  if (!result.ok) return result;
  return ok(result.data.map(toUserProjectResponse));
}
