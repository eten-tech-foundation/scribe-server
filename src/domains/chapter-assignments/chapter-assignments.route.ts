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

const chapterAssignmentProgressSchema = z.object({
  book: z.string(),
  chapter_number: z.number(),
  assigned_user: z.string(),
  project_unit_id: z.number(),
  assignment_id: z.number(),
  progress: z.string(),
});

const chapterAssignmentByEmailSchema = z.object({
  project_name: z.string(),
  project_unit_id: z.number(),
  book_id: z.number(),
  book: z.string(),
  chapter_number: z.number(),
  progress: z.string(),
  is_submitted: z.boolean(),
  submitted_time: z.string().nullable(),
});

const assignUsersToChaptersSchema = z.object({
  chapterAssignmentId: z
    .array(z.number().int())
    .min(1, 'At least one chapter assignment ID is required'),
  userId: z.number().int(),
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

server.use('/projects/:id/chapters', requireProjectAccess);

server.openapi(getProjectChaptersRoute, async (c) => {
  const { id } = c.req.valid('param');

  const result = await chapterAssignmentsHandler.getProjectChapters(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
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

server.use('/projects/:id/chapter-assignments', requireProjectAccess);

server.openapi(getChapterAssignmentsRoute, async (c) => {
  const { id } = c.req.valid('param');

  const result = await chapterAssignmentsHandler.getChapterAssignmentsByProject(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

// DELETE /projects/{id}/chapter-assignments
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

const getChapterAssignmentsByEmailRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'get',
  path: '/chapter-assignments/user/{email}',
  request: {
    params: z.object({
      email: z
        .string()
        .email()
        .openapi({
          param: {
            name: 'email',
            in: 'path',
            required: true,
            allowReserved: false,
          },
          example: 'user@example.com',
        }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      chapterAssignmentByEmailSchema.array().openapi('ChapterAssignmentsByEmail'),
      'Chapter assignments for the user by email'
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
  summary: 'Get chapter assignments by user email',
  description:
    'Returns all chapter assignments for a user identified by email with progress and submission status',
});

server.use('/chapter-assignments/user/:email', requireUserAccess);

server.openapi(getChapterAssignmentsByEmailRoute, async (c) => {
  const { email } = c.req.valid('param');

  const result = await chapterAssignmentsHandler.getChapterAssignmentsByEmail(email);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
