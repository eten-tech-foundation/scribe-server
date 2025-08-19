import type { z } from '@hono/zod-openapi';

import { eq } from 'drizzle-orm';

import type { insertProjectsSchema, patchProjectsSchema, selectProjectsSchema } from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import { projects, users } from '@/db/schema';

export type Project = z.infer<typeof selectProjectsSchema>;
export type CreateProjectInput = z.infer<typeof insertProjectsSchema>;
export type UpdateProjectInput = z.infer<typeof patchProjectsSchema>;

export async function getAllProjects(): Promise<Result<Project[]>> {
  const projectList = await db.select().from(projects);

  return projectList
    ? { ok: true, data: projectList as Project[] }
    : { ok: false, error: { message: 'No Projects found - or internal error' } };
}

export async function getProjectsByOrganization(
  organizationId: number
): Promise<Result<Project[]>> {
  const projectList = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      sourceLanguages: projects.sourceLanguages,
      targetLanguage: projects.targetLanguage,
      isActive: projects.isActive,
      createdBy: projects.createdBy,
      assignedTo: projects.assignedTo,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      metadata: projects.metadata,
    })
    .from(projects)
    .innerJoin(users, eq(projects.createdBy, users.id))
    .where(eq(users.organization, organizationId));

  return projectList
    ? { ok: true, data: projectList as Project[] }
    : { ok: false, error: { message: 'No Projects found in organization - or internal error' } };
}

export async function getProjectById(id: number): Promise<Result<Project>> {
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return project
    ? { ok: true, data: project as Project }
    : { ok: false, error: { message: 'Project not found' } };
}

export async function getProjectsAssignedToUser(userId: number): Promise<Result<Project[]>> {
  const projectList = await db.select().from(projects).where(eq(projects.assignedTo, userId));

  return projectList
    ? { ok: true, data: projectList as Project[] }
    : { ok: false, error: { message: 'No Projects assigned to user - or internal error' } };
}

export async function createProject(input: CreateProjectInput): Promise<Result<Project>> {
  const [project] = await db.insert(projects).values(input).returning();

  return project
    ? { ok: true, data: project as Project }
    : { ok: false, error: { message: 'Unable to create project' } };
}

export async function updateProject(
  id: number,
  input: UpdateProjectInput
): Promise<Result<Project>> {
  const [updated] = await db.update(projects).set(input).where(eq(projects.id, id)).returning();

  return updated
    ? { ok: true, data: updated as Project }
    : { ok: false, error: { message: 'Cannot update project' } };
}

export async function deleteProject(id: number): Promise<Result<boolean>> {
  const result = await db
    .delete(projects)
    .where(eq(projects.id, id))
    .returning({ id: projects.id });

  return result.length > 0
    ? { ok: true, data: true }
    : { ok: false, error: { message: 'Cannot delete project' } };
}
