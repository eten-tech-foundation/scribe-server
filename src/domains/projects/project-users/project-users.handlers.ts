import { and, eq, or } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { chapter_assignments, project_units, project_users, users } from '@/db/schema';
import { logger } from '@/lib/logger';

export interface ProjectUserRecord {
  id: number;
  projectId: number;
  userId: number;
  displayName: string;
  roleID: number;
  addedAt: Date | null;
}

// GET -- all users for a project
export async function getProjectUsers(projectId: number): Promise<Result<ProjectUserRecord[]>> {
  try {
    const rows = await db
      .select({
        id: project_users.id,
        projectId: project_users.projectId,
        userId: project_users.userId,
        displayName: users.username,
        roleID: users.role,
        addedAt: project_users.addedAt,
      })
      .from(project_users)
      .innerJoin(users, eq(project_users.userId, users.id))
      .where(eq(project_users.projectId, projectId))
      .orderBy(users.username);

    return { ok: true, data: rows };
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to get project users',
      context: { projectId },
    });
    return { ok: false, error: { message: 'Failed to get project users' } };
  }
}

// POST -- add a user to a project
export async function addProjectUser(
  projectId: number,
  userId: number
): Promise<Result<ProjectUserRecord>> {
  try {
    // Check user isn't already in the project
    const [existing] = await db
      .select({ id: project_users.id })
      .from(project_users)
      .where(and(eq(project_users.projectId, projectId), eq(project_users.userId, userId)))
      .limit(1);

    if (existing) {
      return { ok: false, error: { message: 'User is already in this project' } };
    }

    const [inserted] = await db.insert(project_users).values({ projectId, userId }).returning();

    const [user] = await db
      .select({ username: users.username, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return {
      ok: true,
      data: {
        id: inserted.id,
        projectId: inserted.projectId,
        userId: inserted.userId,
        displayName: user?.username ?? '',
        roleID: user?.role ?? 0,
        addedAt: inserted.addedAt,
      },
    };
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to add user to project',
      context: { projectId, userId },
    });
    return { ok: false, error: { message: 'Failed to add user to project' } };
  }
}

// DELETE -- remove a user from a project
export async function removeProjectUser(
  projectId: number,
  userId: number
): Promise<Result<{ removed: boolean }>> {
  try {
    const [assignedContent] = await db
      .select({ id: chapter_assignments.id })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .where(
        and(
          eq(project_units.projectId, projectId),
          or(
            eq(chapter_assignments.assignedUserId, userId),
            eq(chapter_assignments.peerCheckerId, userId)
          )
        )
      )
      .limit(1);

    if (assignedContent) {
      return {
        ok: false,
        error: { message: 'User still has content assigned' },
      };
    }

    const deleted = await db
      .delete(project_users)
      .where(and(eq(project_users.projectId, projectId), eq(project_users.userId, userId)))
      .returning({ id: project_users.id });

    if (deleted.length === 0) {
      return { ok: false, error: { message: 'User not found in project' } };
    }

    return { ok: true, data: { removed: true } };
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to remove user from project',
      context: { projectId, userId },
    });
    return { ok: false, error: { message: 'Failed to remove user from project' } };
  }
}
