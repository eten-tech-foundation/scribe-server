import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import * as activeEditorsHandler from '@/domains/chapter-assignments/presence/chapter-assignments-presence.handlers';
import { authenticateUser } from '@/middlewares/role-auth';
import { server } from '@/server/server';
const chapterAssignmentIdParam = z.object({
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
});

const presenceResponseSchema = z.object({
  isFirstEditor: z.boolean().openapi({
    description: 'Is the current user the first one editing?',
  }),
  firstEditorName: z.string().nullable().openapi({
    description: 'Display name of the first editor if current user is not first',
  }),
});

const registerPresenceRoute = createRoute({
  tags: ['Chapter Assignments - Presence'],
  method: 'post',
  path: '/heartbeat/{chapterAssignmentId}/presence',
  middleware: [authenticateUser] as const,
  request: {
    params: chapterAssignmentIdParam,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(presenceResponseSchema, 'Presence registered successfully'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Send heartbeat and check for concurrent editors',
  description:
    'Registers the current user as active on this chapter. Returns information about whether another user was editing this chapter before the current user.',
});

const removePresenceRoute = createRoute({
  tags: ['Chapter Assignments - Presence'],
  method: 'delete',
  path: '/heartbeat/{chapterAssignmentId}/presence',
  middleware: [authenticateUser] as const,
  request: {
    params: chapterAssignmentIdParam,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Presence removed successfully',
    },
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Remove user from active editors',
  description:
    'Removes the current user from the list of active editors for this chapter. Called when user closes the chapter or navigates away.',
});

server.openapi(registerPresenceRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');
  const currentUser = c.get('user');

  if (!currentUser) {
    return c.json({ message: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED);
  }

  const result = await activeEditorsHandler.registerPresenceAndCheck(
    currentUser.id,
    chapterAssignmentId
  );

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

server.openapi(removePresenceRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');
  const currentUser = c.get('user');
  if (!currentUser) {
    return c.json({ message: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED);
  }

  const result = await activeEditorsHandler.removePresence(currentUser.id, chapterAssignmentId);

  if (result.ok) {
    return c.body(null, HttpStatusCodes.NO_CONTENT);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
