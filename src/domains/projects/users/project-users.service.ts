import * as usersService from '@/domains/users/users.service';
import { err, ErrorCode, ok } from '@/lib/types';

import * as repo from './project-users.repository';

export function getProjectUsers(projectId: number) {
  return repo.getProjectUsers(projectId);
}

export function getProjectRolesForUser(projectId: number, userId: number) {
  return repo.getProjectRolesForUser(projectId, userId);
}

export async function addProjectUsers(
  projectId: number,
  userIds: number[],
  projectRole: string
) {
  const usersResult = await usersService.getUsersByIds(userIds);
  if (!usersResult.ok) return err(ErrorCode.INTERNAL_ERROR);

  const foundIds = new Set(usersResult.data.map((u) => u.id));
  const missingId = userIds.find((id) => !foundIds.has(id));
  if (missingId) return err(ErrorCode.USER_NOT_FOUND);

  const insertResult = await repo.addProjectUserRoles(projectId, userIds, projectRole);
  if (!insertResult.ok) return insertResult;

  const userMap = new Map(usersResult.data.map((u) => [u.id, u]));

  return ok(
    insertResult.data.map((row) => ({
      ...row,
      displayName: userMap.get(row.userId)!.username,
    }))
  );
}

export function removeProjectUser(projectId: number, userId: number) {
  return repo.removeAllProjectUserRoles(projectId, userId);
}

export function resolveIsProjectMember(projectId: number, userId: number): Promise<boolean> {
  return repo.resolveIsProjectMember(projectId, userId);
}
