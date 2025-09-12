import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import {
  requireManagerAccess,
  requireProjectAccess,
  requireUserAccess,
} from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as chapterAssignmentsHandler from './chapter-assignments.handlers';

const chapterAssignmentSchema = z.object({
  id: z.number().int().optional(),
  projectUnitId: z.number().int(),
  bibleId: z.number().int(),
  bookId: z.number().int(),
  chapterNumber: z.number().int(),
  assignedUserId: z.number().int().nullable(),
  isSubmitted: z.boolean().optional(),
  submittedTime: z.date().nullable().optional(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
});

const chapterAssignmentProgressSchema = z.object({
  book: z.string(),
  chapterNumber: z.number(),
  assignedUser: z.string(),
  projectUnitId: z.number(),
  assignmentId: z.number(),
  totalVerses: z.number().int(),
  completedVerses: z.number().int(),
  isSubmitted: z.boolean().optional(),
  submittedTime: z.date().nullable().optional(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
});

const chapterAssignmentByUserSchema = z.object({
  projectName: z.string(),
  projectUnitId: z.number(),
  bibleId: z.number(),
  bibleName: z.string(),
  targetLanguage: z.string(),
  bookId: z.number(),
  book: z.string(),
  chapterNumber: z.number(),
  totalVerses: z.number().int(),
  completedVerses: z.number().int(),
  isSubmitted: z.boolean(),
  submittedTime: z.string().nullable(),
});

const assignUsersToChaptersSchema = z.object({
  chapterAssignmentId: z
    .array(z.number().int())
    .min(1, 'At least one chapter assignment ID is required'),
  userId: z.number().int(),
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
      'Manager access required'
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

server.use('/projects/:id/chapter-assignments', requireManagerAccess);

server.openapi(deleteChapterAssignmentsRoute, async (c) => {
  const { id } = c.req.valid('param');

  const result = await chapterAssignmentsHandler.deleteChapterAssignmentsByProject(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const getChapterAssignmentProgressRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'get',
  path: '/projects/{projectId}/chapter-assignments/progress',
  request: {
    params: z.object({
      projectId: z.coerce.number().openapi({
        param: {
          name: 'projectId',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 1,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      chapterAssignmentProgressSchema.array().openapi('ChapterAssignmentProgress'),
      'Chapter assignment progress for the project'
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
  summary: 'Get chapter assignment progress',
  description: 'Returns chapter assignment progress with completion statistics for a project',
});

server.use('/projects/:projectId/chapter-assignments/progress', requireProjectAccess);

server.openapi(getChapterAssignmentProgressRoute, async (c) => {
  const { projectId } = c.req.valid('param');

  const result = await chapterAssignmentsHandler.getChapterAssignmentProgressByProject(projectId);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const assignUsersToChaptersRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'patch',
  path: '/projects/chapter-assignments/assign',
  request: {
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
      'Manager access required'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Chapter assignments not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Assign users to specific chapters',
  description: 'Assigns users to specific chapter assignments',
});

server.use('/projects/chapter-assignments/assign', requireManagerAccess);

server.openapi(assignUsersToChaptersRoute, async (c) => {
  const assignmentData = c.req.valid('json');

  const result = await chapterAssignmentsHandler.assignUsersToChapters(assignmentData);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const getChapterAssignmentsByUserIdRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'get',
  path: '/chapter-assignments/user/{userId}',
  request: {
    params: z.object({
      userId: z.coerce.number().openapi({
        param: {
          name: 'userId',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 1,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      chapterAssignmentByUserSchema.array().openapi('ChapterAssignmentsByUser'),
      'Chapter assignments for the user with bible and language details'
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
  summary: 'Get chapter assignments by user ID',
  description: 'Returns all chapter assignments for a user',
});

server.use('/chapter-assignments/user/:userId', requireUserAccess);

server.openapi(getChapterAssignmentsByUserIdRoute, async (c) => {
  const { userId } = c.req.valid('param');

  const result = await chapterAssignmentsHandler.getChapterAssignmentsByUserId(userId);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
