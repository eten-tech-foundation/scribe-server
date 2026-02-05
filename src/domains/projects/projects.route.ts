import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { insertProjectsSchema, patchProjectsSchema, selectProjectsSchema } from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';
import { requireManagerAccess, requireOrgAccess, requireProjectAccess } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as projectHandler from './projects.handlers';

const projectWithLanguageNamesSchema = selectProjectsSchema
  .omit({ sourceLanguage: true, targetLanguage: true })
  .extend({
    sourceLanguageName: z.string(),
    targetLanguageName: z.string(),
    sourceName: z.string().optional(),
  });

const createProjectWithUnitsSchema = insertProjectsSchema.extend({
  bibleId: z.number().int(),
  bookId: z.array(z.number().int()),
  status: z.enum(['not_started', 'in_progress', 'completed']).default('not_started'),
});

const updateProjectWithUnitsSchema = patchProjectsSchema.extend({
  bibleId: z.number().int().optional(),
  bookId: z.array(z.number().int()).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).default('not_started').optional(),
});

const listProjectsRoute = createRoute({
  tags: ['Projects'],
  method: 'get',
  path: '/projects',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      projectWithLanguageNamesSchema.array().openapi('Projects'),
      'The list of projects within the organization'
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
  summary: 'Get all projects',
  description: 'Returns a list of all projects within the organization',
});

server.use('/projects', requireOrgAccess);

server.openapi(listProjectsRoute, async (c) => {
  const currentUser = c.get('user');

  const result = await projectHandler.getProjectsByOrganization(currentUser!.organization);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const createProjectRoute = createRoute({
  tags: ['Projects'],
  method: 'post',
  path: '/projects',
  request: {
    body: jsonContent(createProjectWithUnitsSchema, 'The project to create with units and books'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(selectProjectsSchema, 'The created project'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Validation error or constraint violation'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Manager access required'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.object({
        success: z.boolean(),
        error: z.object({
          issues: z.array(
            z.object({
              code: z.string(),
              path: z.array(z.string()),
              message: z.string(),
            })
          ),
          name: z.string(),
        }),
      }),
      'The validation error'
    ),
  },
  summary: 'Create a new project',
  description: 'Creates a new project with the provided data',
});

server.openapi(createProjectRoute, async (c) => {
  const projectData = c.req.valid('json');
  const currentUser = c.get('user');

  projectData.createdBy = currentUser!.id;
  if (!projectData.organization) {
    projectData.organization = currentUser!.organization;
  }

  const result = await projectHandler.createProject(projectData);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.CREATED);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
});

const getProjectRoute = createRoute({
  tags: ['Projects'],
  method: 'get',
  path: '/projects/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 1,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(projectWithLanguageNamesSchema, 'The project'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Access denied'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get a project by ID',
  description: 'Returns a single project by its ID',
});

server.use('/projects/:id', requireProjectAccess);

server.openapi(getProjectRoute, async (c) => {
  const { id } = c.req.valid('param');

  const result = await projectHandler.getProjectById(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message === 'Project not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const updateProjectRoute = createRoute({
  tags: ['Projects'],
  method: 'patch',
  path: '/projects/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 1,
      }),
    }),
    body: jsonContent(
      updateProjectWithUnitsSchema,
      'The project updates with optional units and books'
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectProjectsSchema, 'The updated project'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Validation or constraint error'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Access denied'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.object({
        success: z.boolean(),
        error: z.object({
          issues: z.array(
            z.object({
              code: z.string(),
              path: z.array(z.string()),
              message: z.string(),
            })
          ),
          name: z.string(),
        }),
      }),
      'The validation error'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Update a project',
  description: 'Updates a project with the provided data',
});

server.use('/projects/:id', requireProjectAccess);

server.openapi(updateProjectRoute, async (c) => {
  const { id } = c.req.valid('param');
  const updates = c.req.valid('json');

  if (Object.keys(updates).length === 0) {
    return c.json(
      {
        success: false,
        error: {
          issues: [
            {
              code: ZOD_ERROR_CODES.INVALID_UPDATES,
              path: [],
              message: ZOD_ERROR_MESSAGES.NO_UPDATES,
            },
          ],
          name: 'ZodError',
        },
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }

  const result = await projectHandler.updateProject(id, updates);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message === 'Project not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const deleteProjectRoute = createRoute({
  tags: ['Projects'],
  method: 'delete',
  path: '/projects/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 1,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Project deleted',
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
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
  summary: 'Delete a project',
  description: 'Deletes a project by its ID',
});

server.use('/projects/:id', requireManagerAccess);

server.openapi(deleteProjectRoute, async (c) => {
  const { id } = c.req.valid('param');

  const result = await projectHandler.deleteProject(id);

  if (result.ok) {
    return c.body(null, HttpStatusCodes.NO_CONTENT);
  }

  if (result.error.message === 'Project not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
