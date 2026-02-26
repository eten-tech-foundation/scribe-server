import { createRoute, z } from '@hono/zod-openapi';
import { and, eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { db } from '@/db';
import {
  chapterStatusEnum,
  insertProjectsSchema,
  patchProjectsSchema,
  project_users,
  selectProjectsSchema,
} from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { ROLES } from '@/lib/roles';
import { requirePermission } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import { ProjectPolicy } from './project.policy';
import * as projectHandler from './projects.handlers';

// ─── Response schemas ─────────────────────────────────────────────────────────

const chapterStatusCountsSchema = z.object(
  chapterStatusEnum.enumValues.reduce(
    (acc, status) => {
      acc[status] = z.number().int().min(0);
      return acc;
    },
    {} as Record<string, z.ZodNumber>
  )
);

const workflowStepSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const projectWithLanguageNamesSchema = selectProjectsSchema
  .omit({ sourceLanguage: true, targetLanguage: true })
  .extend({
    sourceLanguageName: z.string(),
    targetLanguageName: z.string(),
    sourceName: z.string(),
    lastChapterActivity: z.union([z.date(), z.string()]).nullable(),
    createdAt: z.union([z.date(), z.string()]).nullable(),
    updatedAt: z.union([z.date(), z.string()]).nullable(),
    chapterStatusCounts: chapterStatusCountsSchema,
    workflowConfig: z.array(workflowStepSchema),
  });

// ─── Request schemas ──────────────────────────────────────────────────────────

const createProjectWithUnitsSchema = insertProjectsSchema.extend({
  bibleId: z.number().int(),
  bookId: z.array(z.number().int()),
  projectUnitStatus: z.enum(['not_started', 'in_progress', 'completed']).default('not_started'),
});

const updateProjectWithUnitsSchema = patchProjectsSchema.extend({
  bibleId: z.number().int().optional(),
  bookId: z.array(z.number().int()).optional(),
  projectUnitStatus: z.enum(['not_started', 'in_progress', 'completed']).optional(),
});

const idParam = z.object({
  id: z.coerce.number().openapi({
    param: { name: 'id', in: 'path', required: true },
    example: 1,
  }),
});

// ─── GET /projects ────────────────────────────────────────────────────────────

const listProjectsRoute = createRoute({
  tags: ['Projects'],
  method: 'get',
  path: '/projects',
  middleware: [requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      projectWithLanguageNamesSchema.array().openapi('Projects'),
      'List of projects'
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
  summary: 'Get all projects',
  description: 'Project Managers: all projects in their organisation.',
});

server.openapi(listProjectsRoute, async (c) => {
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  // Explicitly prevent translators from using this route.
  if (!ProjectPolicy.list(policyUser)) {
    return c.json(
      { message: 'Forbidden: You do not have permission to list all projects.' },
      HttpStatusCodes.FORBIDDEN
    );
  }

  const result = await projectHandler.getProjectsByOrganization(currentUser.organization);
  if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
  return c.json({ message: result.error.message as string }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

// ─── POST /projects ───────────────────────────────────────────────────────────

const createProjectRoute = createRoute({
  tags: ['Projects'],
  method: 'post',
  path: '/projects',
  middleware: [requirePermission(PERMISSIONS.PROJECT_CREATE)] as const,
  request: {
    body: jsonContent(createProjectWithUnitsSchema, 'The project to create'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(selectProjectsSchema, 'The created project'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
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
      'Validation error'
    ),
  },
  summary: 'Create a new project',
  description: 'Project Manager only.',
});

server.openapi(createProjectRoute, async (c) => {
  const projectData = c.req.valid('json');
  const currentUser = c.get('user')!;

  projectData.createdBy = currentUser.id;
  projectData.organization = projectData.organization ?? currentUser.organization;

  const result = await projectHandler.createProject(projectData);
  if (result.ok) return c.json(result.data, HttpStatusCodes.CREATED);
  return c.json({ message: result.error.message as string }, HttpStatusCodes.BAD_REQUEST);
});

// ─── GET /projects/:id ────────────────────────────────────────────────────────

const getProjectRoute = createRoute({
  tags: ['Projects'],
  method: 'get',
  path: '/projects/{id}',
  middleware: [requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
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
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get a project by ID',
});

server.openapi(getProjectRoute, async (c) => {
  const { id } = c.req.valid('param');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const result = await projectHandler.getProjectById(id);

  if (!result.ok) {
    if (result.error.message === 'Project not found') {
      return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
    }
    return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  // Check if Translator is assigned to this project
  let isAssignedToProject = false;
  if (currentUser.roleName === ROLES.TRANSLATOR) {
    const [member] = await db
      .select()
      .from(project_users)
      .where(and(eq(project_users.projectId, id), eq(project_users.userId, currentUser.id)))
      .limit(1);
    isAssignedToProject = member !== undefined;
  }

  if (!ProjectPolicy.read(policyUser, result.data, isAssignedToProject)) {
    return c.json(
      { message: 'Forbidden: You do not have permission to view this project.' },
      HttpStatusCodes.FORBIDDEN
    );
  }

  return c.json(result.data, HttpStatusCodes.OK);
});

// ─── PATCH /projects/:id ──────────────────────────────────────────────────────

const updateProjectRoute = createRoute({
  tags: ['Projects'],
  method: 'patch',
  path: '/projects/{id}',
  middleware: [requirePermission(PERMISSIONS.PROJECT_UPDATE)] as const,
  request: {
    params: idParam,
    body: jsonContent(updateProjectWithUnitsSchema, 'The project updates'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectProjectsSchema, 'The updated project'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Constraint error'
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
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
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
      'Validation error'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Update a project',
  description: 'Project Manager only.',
});

server.openapi(updateProjectRoute, async (c) => {
  const { id } = c.req.valid('param');
  const updates = c.req.valid('json');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

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

  const projectResult = await projectHandler.getProjectById(id);
  if (!projectResult.ok) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  // Cross-tenant protection
  if (!ProjectPolicy.update(policyUser, projectResult.data)) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const result = await projectHandler.updateProject(id, updates);
  if (result.ok) return c.json(result.data, HttpStatusCodes.OK);

  return result.error.message === 'Project not found'
    ? c.json({ message: result.error.message as string }, HttpStatusCodes.NOT_FOUND)
    : c.json({ message: result.error.message as string }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

// ─── DELETE /projects/:id ─────────────────────────────────────────────────────

const deleteProjectRoute = createRoute({
  tags: ['Projects'],
  method: 'delete',
  path: '/projects/{id}',
  middleware: [requirePermission(PERMISSIONS.PROJECT_DELETE)] as const,
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
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Delete a project',
  description: 'Project Manager only.',
});

server.openapi(deleteProjectRoute, async (c) => {
  const { id } = c.req.valid('param');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const projectResult = await projectHandler.getProjectById(id);
  if (!projectResult.ok) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  // Cross-tenant protection
  if (!ProjectPolicy.delete(policyUser, projectResult.data)) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const result = await projectHandler.deleteProject(id);
  if (result.ok) return c.body(null, HttpStatusCodes.NO_CONTENT);

  return result.error.message === 'Project not found'
    ? c.json({ message: result.error.message as string }, HttpStatusCodes.NOT_FOUND)
    : c.json({ message: result.error.message as string }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
