import { and, eq } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { chapter_assignments, project_units, project_user_roles, users } from '@/db/schema';
import { handleConstraintError } from '@/lib/db-errors';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type { ProjectUserRoleResponse } from './project-users.types';

export async function getProjectUsers(
  projectId: number
): Promise<Result<ProjectUserRoleResponse[]>> {
  try {
    const rows = await db
      .select({
        projectId: project_user_roles.projectId,
        userId: project_user_roles.userId,
        projectRole: project_user_roles.projectRole,
        displayName: users.username,
        createdAt: project_user_roles.createdAt,
      })
      .from(project_user_roles)
      .innerJoin(users, eq(project_user_roles.userId, users.id))
      .where(eq(project_user_roles.projectId, projectId))
      .orderBy(users.username);

    return ok(rows);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to get project users',
      context: { projectId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function getProjectRolesForUser(
  projectId: number,
  userId: number
): Promise<Result<string[]>> {
  try {
    const rows = await db
      .select({ projectRole: project_user_roles.projectRole })
      .from(project_user_roles)
      .where(
        and(eq(project_user_roles.projectId, projectId), eq(project_user_roles.userId, userId))
      );
    return ok(rows.map((r) => r.projectRole));
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to get project roles for user',
      context: { projectId, userId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function addProjectUserRoles(
  projectId: number,
  userIds: number[],
  projectRole: string
): Promise<
  Result<{ projectId: number; userId: number; projectRole: string; createdAt: Date | null }[]>
> {
  if (userIds.length === 0) return ok([]);
  try {
    const inserted = await db
      .insert(project_user_roles)
      .values(userIds.map((userId) => ({ projectId, userId, projectRole: projectRole as any })))
      .onConflictDoNothing()
      .returning({
        projectId: project_user_roles.projectId,
        userId: project_user_roles.userId,
        projectRole: project_user_roles.projectRole,
        createdAt: project_user_roles.createdAt,
      });
    return ok(inserted);
  } catch (error) {
    const constraintResult = handleConstraintError(error);
    if (!constraintResult.ok && constraintResult.error.code === ErrorCode.DUPLICATE) {
      return err(ErrorCode.USER_ALREADY_IN_PROJECT);
    }
    logger.error({
      cause: error,
      message: 'Failed to add users to project',
      context: { projectId, userIds },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function removeAllProjectUserRoles(
  projectId: number,
  userId: number
): Promise<Result<void>> {
  try {
    const [assignedContent] = await db
      .select({ userId: chapter_assignments.assignedUserId })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .where(
        and(eq(project_units.projectId, projectId), eq(chapter_assignments.assignedUserId, userId))
      )
      .limit(1);

    if (assignedContent) return err(ErrorCode.USER_HAS_ASSIGNED_CONTENT);

    await db
      .delete(project_user_roles)
      .where(
        and(eq(project_user_roles.projectId, projectId), eq(project_user_roles.userId, userId))
      );

    return ok(undefined);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to remove user from project',
      context: { projectId, userId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function resolveIsProjectMember(projectId: number, userId: number): Promise<boolean> {
  const [member] = await db
    .select({ projectId: project_user_roles.projectId })
    .from(project_user_roles)
    .where(and(eq(project_user_roles.projectId, projectId), eq(project_user_roles.userId, userId)))
    .limit(1);

  return member !== undefined;
}
