import type { Result } from '@/lib/types';

import type {
  CreateProjectInput,
  Project,
  ProjectWithLanguageNames,
  UpdateProjectInput,
} from './projects.types';

import * as repo from './projects.repository';

export function getProjectsByOrganization(
  organizationId: number
): Promise<Result<ProjectWithLanguageNames[]>> {
  return repo.getByOrganization(organizationId);
}

export function getProjectById(id: number): Promise<Result<ProjectWithLanguageNames>> {
  return repo.getById(id);
}

export function createProject(input: CreateProjectInput): Promise<Result<Project>> {
  return repo.create(input);
}

export function updateProject(id: number, input: UpdateProjectInput): Promise<Result<Project>> {
  return repo.update(id, input);
}

export function deleteProject(id: number): Promise<Result<void>> {
  return repo.remove(id);
}

export function getProjectIdByUnitId(
  projectUnitId: number
): Promise<Result<{ projectId: number }>> {
  return repo.getProjectIdByUnitId(projectUnitId);
}
