import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { requireProjectAccess } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as chapterAssignmentsHandler from './chapter-assignments.handlers';

const chapterInfoSchema = z.object({
  bibleId: z.number().int(),
  bookId: z.number().int(),
  chapterNumber: z.number().int(),
  verseCount: z.number().int(),
});

const chapterAssignmentSchema = z.object({
  id: z.number().int().optional(),
  projectUnitId: z.number().int(),
  bibleId: z.number().int(),
  bookId: z.number().int(),
  chapterNumber: z.number().int(),
  assignedUserId: z.number().int().nullable(),
  createdAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime().nullable().optional(),
});

const assignUsersToChaptersSchema = z.object({
  userAssignments: z
    .array(
      z.object({
        chapterAssignmentId: z.number().int(),
        userId: z.number().int(),
      })
    )
    .min(1, 'At least one assignment is required'),
});

const getProjectChaptersRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'get',
  path: '/projects/{id}/chapters',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 6,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      chapterInfoSchema.array().openapi('ProjectChapters'),
      'The list of chapters with verse counts for the project'
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
  summary: 'Get all chapters for a project',
  description: 'Returns a list of all chapters with verse counts for a specific project',
});

const getChapterAssignmentsRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'get',
  path: '/projects/{id}/chapter-assignments',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 6,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      chapterAssignmentSchema.array().openapi('ChapterAssignments'),
      'The list of chapter assignments for the project'
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
  summary: 'Get chapter assignments for a project',
  description: 'Returns all chapter assignments for a specific project',
});

const assignUsersToChaptersRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'patch',
  path: '/projects/{id}/chapter-assignments/assign',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 6,
      }),
    }),
    body: jsonContent(assignUsersToChaptersSchema, 'User assignment data for specific chapters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      chapterAssignmentSchema.array().openapi('ChapterAssignments'),
      'Successfully assigned users to chapters'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Invalid request data'
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
  summary: 'Assign users to specific chapters',
  description: 'Assigns users to specific chapter assignments',
});

const deleteChapterAssignmentsRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'delete',
  path: '/projects/{id}/chapter-assignments',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 6,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ deletedCount: z.number().int() }).openapi('DeleteResult'),
      'Successfully deleted chapter assignments'
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
  summary: 'Delete all chapter assignments for a project',
  description: 'Deletes all chapter assignments associated with a specific project',
});

server.use('/projects/:id/chapters', requireProjectAccess);
server.use('/projects/:id/chapter-assignments', requireProjectAccess);

server.openapi(getProjectChaptersRoute, async (c) => {
  const { id } = c.req.valid('param');

  const result = await chapterAssignmentsHandler.getProjectChapters(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

server.openapi(getChapterAssignmentsRoute, async (c) => {
  const { id } = c.req.valid('param');

  const result = await chapterAssignmentsHandler.getChapterAssignmentsByProject(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

server.openapi(assignUsersToChaptersRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { userAssignments } = c.req.valid('json');

  const result = await chapterAssignmentsHandler.assignUsersToChapters(id, userAssignments);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

server.openapi(deleteChapterAssignmentsRoute, async (c) => {
  const { id } = c.req.valid('param');

  const result = await chapterAssignmentsHandler.deleteChapterAssignmentsByProject(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
