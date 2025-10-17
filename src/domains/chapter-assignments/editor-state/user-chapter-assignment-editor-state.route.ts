import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import {
  insertUserChapterAssignmentEditorStateSchema,
  selectUserChapterAssignmentEditorStateSchema,
} from '@/db/schema';
import { requireUserAccess } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as editorStateHandler from './user-chapter-assignment-editor-state.handlers';

const getEditorStateRoute = createRoute({
  tags: ['Chapter Assignments - Editor State'],
  method: 'get',
  path: '/chapter-assignments/{chapterAssignmentId}/editor-state',
  request: {
    params: z.object({
      chapterAssignmentId: z.coerce
        .number()
        .int()
        .positive()
        .openapi({
          param: {
            name: 'chapterAssignmentId',
            in: 'path',
            required: true,
          },
          description: 'Chapter assignment ID',
          example: 1,
        }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectUserChapterAssignmentEditorStateSchema.nullable(),
      'The editor state for the current user (null if not previously saved)'
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
  summary: 'Get editor state for current user',
  description:
    'Returns the saved editor state (last opened resources) for the current user and specified chapter assignment. Returns null if no state has been saved yet.',
});

server.use('/chapter-assignments/:chapterAssignmentId/editor-state', requireUserAccess);

server.openapi(getEditorStateRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');
  const currentUser = c.get('user');

  const result = await editorStateHandler.getEditorState(currentUser!.id, chapterAssignmentId);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const saveEditorStateRoute = createRoute({
  tags: ['Chapter Assignments - Editor State'],
  method: 'put',
  path: '/chapter-assignments/{chapterAssignmentId}/editor-state',
  request: {
    params: z.object({
      chapterAssignmentId: z.coerce
        .number()
        .int()
        .positive()
        .openapi({
          param: {
            name: 'chapterAssignmentId',
            in: 'path',
            required: true,
          },
          description: 'Chapter assignment ID',
          example: 1,
        }),
    }),
    body: jsonContent(
      insertUserChapterAssignmentEditorStateSchema
        .omit({ userId: true, chapterAssignmentId: true })
        .openapi('EditorStateInput'),
      'The editor state to save (last opened resources)'
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectUserChapterAssignmentEditorStateSchema,
      'The saved editor state'
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
      'Validation error'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Save editor state for current user',
  description:
    'Saves or updates the editor state (selected resources) for the current user and chapter assignment. This is idempotent - calling it multiple times with the same data will update the existing record.',
});

server.openapi(saveEditorStateRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');
  const editorStateData = c.req.valid('json');
  const currentUser = c.get('user');

  const result = await editorStateHandler.upsertEditorState({
    userId: currentUser!.id,
    chapterAssignmentId,
    ...editorStateData,
  });

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
});
