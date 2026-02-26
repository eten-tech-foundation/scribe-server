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
import { authenticateUser, requirePermission } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as projectUnitsBibleBooksHandler from './project-books.handlers';

const projectBookSchema = z.object({
  bookId: z.number().int(),
  code: z.string(),
  engDisplayName: z.string(),
});

const getProjectBooksRoute = createRoute({
  tags: ['Projects - Bible Books'],
  method: 'get',
  path: '/projects/{projectId}/books',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      projectBookSchema.array().openapi('ProjectBooks'),
      'The list of bible books associated with the project'
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
  summary: 'Get all bible books for a project',
  description: 'Returns a list of all bible books associated with a specific project',
});

server.openapi(getProjectBooksRoute, async (c) => {
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

  const result = await projectUnitsBibleBooksHandler.getBooksByProjectId(projectId);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
