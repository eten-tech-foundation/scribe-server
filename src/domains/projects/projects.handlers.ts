import type { z } from '@hono/zod-openapi';

import { eq } from 'drizzle-orm';

import type { insertProjectsSchema, patchProjectsSchema, selectProjectsSchema } from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import { projects } from '@/db/schema';

export type Project = z.infer<typeof selectProjectsSchema>;
export type CreateProjectInput = z.infer<typeof insertProjectsSchema>;
export type UpdateProjectInput = z.infer<typeof patchProjectsSchema>;

export async function getAllProjects(): Promise<Result<Project[]>> {
  try {
    const projectList = await db.select().from(projects);
    return { ok: true, data: projectList as Project[] };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch projects' } };
  }
}

export async function getProjectsByOrganization(
  organizationId: number
): Promise<Result<Project[]>> {
  try {
    const projectList = await db
      .select()
      .from(projects)
      .where(eq(projects.organization, organizationId));

    return { ok: true, data: projectList as Project[] };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch organization projects' } };
  }
}

export async function getProjectById(id: number): Promise<Result<Project>> {
  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

    if (!project) {
      return { ok: false, error: { message: 'Project not found' } };
    }

    return { ok: true, data: project as Project };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch project' } };
  }
}

export async function getProjectsAssignedToUser(userId: number): Promise<Result<Project[]>> {
  try {
    const projectList = await db.select().from(projects).where(eq(projects.assignedTo, userId));
    return { ok: true, data: projectList as Project[] };
  } catch {
    return { ok: false, error: { message: "Failed to fetch user's assigned projects" } };
  }
}

export async function createProject(input: CreateProjectInput): Promise<Result<Project>> {
  try {
    const [project] = await db.insert(projects).values(input).returning();
    return { ok: true, data: project as Project };
  } catch {
    return { ok: false, error: { message: 'Failed to create project' } };
  }
}

export async function updateProject(
  id: number,
  input: UpdateProjectInput
): Promise<Result<Project>> {
  try {
    const [updated] = await db.update(projects).set(input).where(eq(projects.id, id)).returning();

    if (!updated) {
      return { ok: false, error: { message: 'Project not found' } };
    }

    return { ok: true, data: updated as Project };
  } catch {
    return { ok: false, error: { message: 'Failed to update project' } };
  }
}

export async function deleteProject(id: number): Promise<Result<{ id: number }>> {
  try {
    const result = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });

    if (result.length === 0) {
      return { ok: false, error: { message: 'Project not found' } };
    }

    return { ok: true, data: { id: result[0].id } };
  } catch {
    return { ok: false, error: { message: 'Failed to delete project' } };
  }
}
