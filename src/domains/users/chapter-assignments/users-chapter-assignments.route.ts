import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { requireManagerAccess, requireUserAccess } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as usersChapterAssignmentsHandler from './users-chapter-assignments.handlers';

const getChapterAssignmentByUserResponse = z.object({
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
  submittedTime: z.string().nullable(),
});

const getChapterAssignmentsByUserIdRoute = createRoute({
  tags: ['Users - Chapter Assignments'],
  method: 'get',
  path: '/users/{userId}/chapter-assignments',
  request: {
    params: z.object({
      userId: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      getChapterAssignmentByUserResponse.array().openapi('ChapterAssignmentsByUser'),
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

server.use('users/:userId/chapter-assignments/', requireUserAccess);

server.openapi(getChapterAssignmentsByUserIdRoute, async (c) => {
  const { userId } = c.req.valid('param');

  const result = await usersChapterAssignmentsHandler.getChapterAssignmentsByUserId(userId);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const assignUsersToChapterAssignmentsRequest = z.object({
  chapterAssignmentIds: z
    .array(z.number().int())
    .min(1, 'At least one chapter assignment ID is required'),
});

const assignUsersToChaptersRoute = createRoute({
  tags: ['Users - Chapter Assignments'],
  method: 'patch',
  path: '/users/{userId}/chapter-assignments',
  request: {
    params: z.object({
      userId: z.coerce.number().int().positive(),
    }),
    body: jsonContent(
      assignUsersToChapterAssignmentsRequest,
      'User assignment data for specific chapters'
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(z.number().int()).openapi('UserChapterAssignments'),
      'Successfully assigned user to chapters'
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
  summary: 'Assign user to specific chapters',
  description: 'Assigns a user to specific chapter assignments.',
});

server.use('/users/:userId/chapter-assignments', requireManagerAccess);

server.openapi(assignUsersToChaptersRoute, async (c) => {
  const assignedUserId = c.req.valid('param').userId;
  const assignmentData = c.req.valid('json');

  const result = await usersChapterAssignmentsHandler.assignUserToChapters(
    assignedUserId,
    assignmentData.chapterAssignmentIds
  );

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
