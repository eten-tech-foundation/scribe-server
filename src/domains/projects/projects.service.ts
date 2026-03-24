import type { CreateProjectInput, UpdateProjectInput } from './projects.types';

import * as repo from './projects.repository';

export function getProjectsByOrganization(organizationId: number) {
  return repo.getByOrganization(organizationId);
}

export function getProjectById(id: number) {
  return repo.getById(id);
}

export function createProject(input: CreateProjectInput) {
  return repo.create(input);
}

export function updateProject(id: number, input: UpdateProjectInput) {
  return repo.update(id, input);
}

export function deleteProject(id: number) {
  return repo.remove(id);
}

export function getProjectIdByUnitId(projectUnitId: number) {
  return repo.getProjectIdByUnitId(projectUnitId);
}
