import * as repo from './project-users.repository';

export function getProjectUsers(projectId: number) {
  return repo.getProjectUsers(projectId);
}

export function addProjectUser(projectId: number, userId: number) {
  return repo.addProjectUser(projectId, userId);
}

export function removeProjectUser(projectId: number, userId: number) {
  return repo.removeProjectUser(projectId, userId);
}

export function resolveIsProjectMember(projectId: number, userId: number, roleName: string) {
  return repo.resolveIsProjectMember(projectId, userId, roleName);
}
