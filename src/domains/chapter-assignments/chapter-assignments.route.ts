import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { requireProjectAccess, requireUserAccess } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as chapterAssignmentsHandler from './chapter-assignments.handlers';

const chapterAssignmentResponse = z.object({
  id: z.number().int().optional(),
  projectUnitId: z.number().int(),
  bibleId: z.number().int(),
  bookId: z.number().int(),
  chapterNumber: z.number().int(),
  assignedUserId: z.number().int().nullable().optional(),
  peerCheckerId: z.number().int().nullable().optional(),
  status: z.enum(['not_started', 'draft', 'peer_check', 'community_review']).optional(),
  submittedTime: z.date().nullable().optional(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
});

// ----------------------------------
// --- START STANDARD CRUD ROUTES ---
// ----------------------------------
const createChapterAssignmentRequest = z.object({
  projectUnitId: z.number().int(),
  bibleId: z.number().int(),
  bookId: z.number().int(),
  chapterNumber: z.number().int(),
  assignedUserId: z.number().int().optional(),
  peerCheckerId: z.number().int().optional(),
});

server.use('/chapter-assignments/*/submit', requireUserAccess);
server.use('/chapter-assignments', requireProjectAccess);
server.use('/chapter-assignments/:id', requireProjectAccess);

const createChapterAssignmentRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'post',
  path: '/chapter-assignments',
  request: {
    body: jsonContent(createChapterAssignmentRequest, 'Chapter assignment data'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      chapterAssignmentResponse,
      'The created chapter assignment'
    ),
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
      'You do not have permission to create chapter assignments for this project.'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
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
          message: z.string(),
        }),
        message: z.string(),
      }),
      'Unprocessable entity'
    ),
  },
  summary: 'Create a new chapter assignment',
  description: 'Creates a new chapter assignment.',
});

server.openapi(createChapterAssignmentRoute, async (c) => {
  const requestData = c.req.valid('json');

  const result = await chapterAssignmentsHandler.createChapterAssignment(requestData);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.CREATED);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
});

// [FIXED] Updated comment to reflect that we update both assigned users
const updateChapterAssignmentRequestSchema = z.object({
  assignedUserId: z.number().int(),
  peerCheckerId: z.number().int(),
});

const updateChapterAssignmentRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'patch',
  path: '/chapter-assignments/{chapterAssignmentId}',
  request: {
    params: z.object({
      chapterAssignmentId: z.coerce.number().int().positive(),
    }),
    body: jsonContent(
      updateChapterAssignmentRequestSchema,
      'Users to assign to the chapter assignment.'
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(chapterAssignmentResponse, 'The updated chapter assignment'),
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
      'You do not have permission to update this chapter assignment.'
    ),
  },
  summary: 'Update a chapter assignment',
  description: 'Updates a chapter assignment.',
});

server.openapi(updateChapterAssignmentRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');
  const requestData = c.req.valid('json');

  const result = await chapterAssignmentsHandler.updateChapterAssignment(
    chapterAssignmentId,
    requestData
  );

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
});

const submitChapterAssignmentRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'patch',
  path: '/chapter-assignments/{chapterAssignmentId}/submit',
  request: {
    params: z.object({
      chapterAssignmentId: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      chapterAssignmentResponse,
      'The submitted chapter assignment'
    ),
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
      'You do not have permission to submit this chapter assignment.'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Chapter assignment not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Submit a chapter assignment',
  description:
    'Advances chapter assignment to next stage: draft → peer_check → community_review. Sets submission timestamp.',
});

server.openapi(submitChapterAssignmentRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');

  const result = await chapterAssignmentsHandler.submitChapterAssignment(chapterAssignmentId);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message === 'Chapter assignment not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  if (result.error.message.includes('Cannot submit assignment')) {
    return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const getChapterAssignmentRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'get',
  path: '/chapter-assignments/{chapterAssignmentId}',
  request: {
    params: z.object({
      chapterAssignmentId: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(chapterAssignmentResponse, 'The chapter assignment'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'You do not have permission to get this chapter assignment.'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Chapter assignment not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get a chapter assignment',
  description: 'Get a chapter assignment.',
});

server.openapi(getChapterAssignmentRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');

  const result = await chapterAssignmentsHandler.getChapterAssignment(chapterAssignmentId);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message === 'Chapter assignment not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const deleteChapterAssignmentRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'delete',
  path: '/chapter-assignments/{chapterAssignmentId}',
  request: {
    params: z.object({
      chapterAssignmentId: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Chapter assignment deleted',
    },
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'You do not have permission to delete this chapter assignment.'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Chapter assignment not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Delete a chapter assignment',
  description: 'Delete a chapter assignment.',
});

server.openapi(deleteChapterAssignmentRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');

  const result = await chapterAssignmentsHandler.deleteChapterAssignment(chapterAssignmentId);

  if (result.ok) {
    return c.body(null, HttpStatusCodes.NO_CONTENT);
  }

  if (result.error.message === 'Chapter assignment not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
// --------------------------------
// --- END STANDARD CRUD ROUTES ---
// --------------------------------

// -----------------------------------
// --- START NON-STANDARD ROUTES ---
// -----------------------------------

// -----------------------------------
// --- END NON-STANDARD ROUTES ---
// -----------------------------------
