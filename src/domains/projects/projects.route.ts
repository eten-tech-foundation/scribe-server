import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { resolveIsProjectMember } from '@/domains/projects/users/project-users.service';
import { ZOD_ERROR_MESSAGES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { getHttpStatus } from '@/lib/types';
import { authenticateUser, requirePermission } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import { ProjectPolicy } from './project.policy';
import * as projectService from './projects.service';
import {
  createProjectWithUnitsSchema,
  projectResponseSchema,
  projectWithLanguageNamesSchema,
  updateProjectWithUnitsSchema,
} from './projects.types';

const idParam = z.object({
  id: z.coerce.number().openapi({ param: { name: 'id', in: 'path', required: true } }),
});

// ─── GET /projects ────────────────────────────────────────────────────────────

const listProjectsRoute = createRoute({
  tags: ['Projects'],
  method: 'get',
  path: '/projects',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
  summary: 'Get all projects',
  description: 'Project Managers: all projects in their organisation.',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(projectWithLanguageNamesSchema.array(), 'List of projects'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Insufficient permissions'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
});

server.openapi(listProjectsRoute, async (c) => {
  const currentUser = c.get('user')!;
  if (!ProjectPolicy.list(currentUser))
    return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);

  const result = await projectService.getProjectsByOrganization(currentUser.organization);
  if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
  return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
});

// ─── POST /projects ───────────────────────────────────────────────────────────

const createProjectRoute = createRoute({
  tags: ['Projects'],
  method: 'post',
  path: '/projects',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_CREATE)] as const,
  summary: 'Create a new project',
  description: 'Project Manager only.',
  request: { body: jsonContentRequired(createProjectWithUnitsSchema, 'Project to create') },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(projectResponseSchema, 'Created project'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.BAD_REQUEST),
      'Constraint violation'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Insufficient permissions'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
});

server.openapi(createProjectRoute, async (c) => {
  const projectData = c.req.valid('json');
  const currentUser = c.get('user')!;

  projectData.createdBy = currentUser.id;
  projectData.organization = currentUser.organization;

  const result = await projectService.createProject(projectData);
  if (result.ok) return c.json(result.data, HttpStatusCodes.CREATED);
  return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
});

// ─── GET /projects/:id ────────────────────────────────────────────────────────

const getProjectRoute = createRoute({
  tags: ['Projects'],
  method: 'get',
  path: '/projects/{id}',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
  summary: 'Get a project by ID',
  request: { params: idParam },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(projectWithLanguageNamesSchema, 'The project'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Insufficient permissions'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema('Not Found'),
      'Project not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
});

server.openapi(getProjectRoute, async (c) => {
  const { id } = c.req.valid('param');
  const currentUser = c.get('user')!;

  const result = await projectService.getProjectById(id);
  if (!result.ok)
    return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);

  const isProjectMember = await resolveIsProjectMember(id, currentUser.id, currentUser.roleName);
  if (!ProjectPolicy.read(currentUser, result.data, isProjectMember)) {
    return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);
  }

  return c.json(result.data, HttpStatusCodes.OK);
});

// ─── PATCH /projects/:id ──────────────────────────────────────────────────────

const updateProjectRoute = createRoute({
  tags: ['Projects'],
  method: 'patch',
  path: '/projects/{id}',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_UPDATE)] as const,
  summary: 'Update a project',
  description: 'Project Manager only.',
  request: {
    params: idParam,
    body: jsonContentRequired(updateProjectWithUnitsSchema, 'Project updates'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(projectResponseSchema, 'Updated project'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.BAD_REQUEST),
      'Constraint violation'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Insufficient permissions'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema('Not Found'),
      'Project not found'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createMessageObjectSchema('Unprocessable Entity'),
      'No updates provided'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
});

server.openapi(updateProjectRoute, async (c) => {
  const { id } = c.req.valid('param');
  const updates = c.req.valid('json');
  const currentUser = c.get('user')!;

  if (Object.keys(updates).length === 0) {
    return c.json({ message: ZOD_ERROR_MESSAGES.NO_UPDATES }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
  }

  const projectResult = await projectService.getProjectById(id);
  if (!projectResult.ok)
    return c.json(
      { message: projectResult.error.message },
      getHttpStatus(projectResult.error) as never
    );
  if (!ProjectPolicy.update(currentUser, projectResult.data))
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);

  const result = await projectService.updateProject(id, updates);
  if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
  return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
});

// ─── DELETE /projects/:id ─────────────────────────────────────────────────────

const deleteProjectRoute = createRoute({
  tags: ['Projects'],
  method: 'delete',
  path: '/projects/{id}',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_DELETE)] as const,
  summary: 'Delete a project',
  description: 'Project Manager only.',
  request: { params: idParam },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: 'Project deleted' },
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Insufficient permissions'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema('Not Found'),
      'Project not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
});

server.openapi(deleteProjectRoute, async (c) => {
  const { id } = c.req.valid('param');
  const currentUser = c.get('user')!;

  const projectResult = await projectService.getProjectById(id);
  if (!projectResult.ok)
    return c.json(
      { message: projectResult.error.message },
      getHttpStatus(projectResult.error) as never
    );
  if (!ProjectPolicy.delete(currentUser, projectResult.data))
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);

  const result = await projectService.deleteProject(id);
  if (result.ok) return c.body(null, HttpStatusCodes.NO_CONTENT);
  return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
});
