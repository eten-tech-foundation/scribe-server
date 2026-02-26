import { createRoute, z } from '@hono/zod-openapi';
import { and, eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { db } from '@/db';
import { project_users } from '@/db/schema';
import { ProjectPolicy } from '@/domains/projects/project.policy';
import * as projectHandler from '@/domains/projects/projects.handlers';
import { PERMISSIONS } from '@/lib/permissions';
import { ROLES } from '@/lib/roles';
import { requirePermission } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as projectUsersHandler from './project-users.handlers';

const projectUserResponse = z.object({
  projectId: z.number().int(),
  userId: z.number().int(),
  displayName: z.string(),
  roleID: z.number().int(),
  createdAt: z.union([z.date(), z.string()]).nullable(),
});

const projectIdParam = z.object({
  projectId: z.coerce.number().int().positive(),
});

// --- GET /projects/:projectId/users ---
const getProjectUsersRoute = createRoute({
  tags: ['Projects - Users'],
  method: 'get',
  path: '/projects/{projectId}/users',
  middleware: [requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
  request: { params: projectIdParam },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      projectUserResponse.array().openapi('ProjectUsers'),
      'List of users in the project'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Project access required'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get project users',
  description: 'Returns all users assigned to a project',
});

server.openapi(getProjectUsersRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const projectResult = await projectHandler.getProjectById(projectId);
  if (!projectResult.ok) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  let isAssignedToProject = false;
  if (currentUser.roleName === ROLES.TRANSLATOR) {
    const [member] = await db
      .select()
      .from(project_users)
      .where(and(eq(project_users.projectId, projectId), eq(project_users.userId, currentUser.id)))
      .limit(1);
    isAssignedToProject = member !== undefined;
  }

  if (!ProjectPolicy.read(policyUser, projectResult.data, isAssignedToProject)) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const result = await projectUsersHandler.getProjectUsers(projectId);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

// --- POST /projects/:projectId/users ---
const addProjectUserRoute = createRoute({
  tags: ['Projects - Users'],
  method: 'post',
  path: '/projects/{projectId}/users',
  middleware: [requirePermission(PERMISSIONS.PROJECT_UPDATE)] as const,
  request: {
    params: projectIdParam,
    body: jsonContent(z.object({ userId: z.number().int() }), 'User to add to the project'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      projectUserResponse.openapi('ProjectUserAdded'),
      'User successfully added to project'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'User already in project or invalid data'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema('Not Found'),
      'Project or User not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Manager access required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Add user to project',
  description: 'Adds a user to the project. Manager only.',
});

server.openapi(addProjectUserRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { userId } = c.req.valid('json');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const projectResult = await projectHandler.getProjectById(projectId);
  if (!projectResult.ok || !ProjectPolicy.update(policyUser, projectResult.data)) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const result = await projectUsersHandler.addProjectUser(projectId, userId);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.CREATED);
  }

  if (result.error.message === 'User not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  if (result.error.message === 'User is already in this project') {
    return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

// --- DELETE /projects/:projectId/users/:userId ---
const removeProjectUserRoute = createRoute({
  tags: ['Projects - Users'],
  method: 'delete',
  path: '/projects/{projectId}/users/{userId}',
  middleware: [requirePermission(PERMISSIONS.PROJECT_UPDATE)] as const,
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive(),
      userId: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'User successfully removed from project',
    },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'User still has content assigned'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Manager access required'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project or User not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Remove user from project',
  description:
    'Removes a user from the project. Fails if the user still has assigned content. Manager only.',
});

server.openapi(removeProjectUserRoute, async (c) => {
  const { projectId, userId } = c.req.valid('param');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const projectResult = await projectHandler.getProjectById(projectId);
  if (!projectResult.ok || !ProjectPolicy.update(policyUser, projectResult.data)) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const result = await projectUsersHandler.removeProjectUser(projectId, userId);

  if (result.ok) {
    return c.body(null, HttpStatusCodes.NO_CONTENT);
  }

  if (result.error.message === 'User still has content assigned') {
    return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
  }

  if (result.error.message === 'User not found in project') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
