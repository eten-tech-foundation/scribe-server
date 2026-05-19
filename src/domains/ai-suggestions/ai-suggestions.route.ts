import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { PERMISSIONS } from '@/lib/permissions';
import { getHttpStatus } from '@/lib/types';
import { authenticateUser, requirePermission } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import { logger } from '@/lib/logger';

import * as aiSuggestionsService from './ai-suggestions.service';
import {
  aiSuggestionsListResponseSchema,
  getAiSuggestionsQuerySchema,
  queueNextVersesRequestSchema,
} from './ai-suggestions.types';

// ─── GET /ai-suggestions ──────────────────────────────────────────────

const getAiSuggestionsRoute = createRoute({
  tags: ['AI Suggestions'],
  method: 'get',
  path: '/ai-suggestions',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
  request: {
    query: getAiSuggestionsQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(aiSuggestionsListResponseSchema, 'List of AI suggestions'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Validation error'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Permission denied'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get pre-generated AI suggestions',
  description: 'Retrieves AI suggestions for the specified bible text IDs.',
});

server.openapi(getAiSuggestionsRoute, async (c) => {
  const query = c.req.valid('query');
  logger.debug({ msg: '[AI Suggestions] GET /ai-suggestions', query });

  // Fetches pre-generated AI suggestions from the database.
  // This is called periodically by the frontend polling mechanism to retrieve
  // suggestions that the background worker has finished processing.
  const result = await aiSuggestionsService.getAiSuggestions(query);
  if (result.ok) {
    logger.debug({ msg: '[AI Suggestions] GET response OK', count: result.data.data.length });
    return c.json(result.data, HttpStatusCodes.OK);
  }

  logger.debug({ msg: '[AI Suggestions] GET response ERROR', error: result.error.message });
  return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
});

// ─── POST /ai-suggestions/queue-next ──────────────────────────────────────────

const queueNextVersesRoute = createRoute({
  tags: ['AI Suggestions'],
  method: 'post',
  path: '/ai-suggestions/queue-next',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
  request: {
    body: jsonContent(queueNextVersesRequestSchema, 'Verses context'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(createMessageObjectSchema('Successfully queued'), 'Queued'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Validation error'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Permission denied'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Queue pre-generation of AI suggestions',
  description:
    'Triggers the queue to generate suggestions for the next few verses ahead of the drafter.',
});

server.openapi(queueNextVersesRoute, async (c) => {
  const body = c.req.valid('json');
  logger.debug({ msg: '[AI Suggestions] POST /ai-suggestions/queue-next', body });

  // Triggers the "Stay Ahead" workflow: when a drafter moves to a new verse,
  // this endpoint computes the next N verses and queues them as background jobs.
  // The API responds immediately, letting the frontend stay responsive while
  // the AI worker processes the jobs asynchronously.
  const result = await aiSuggestionsService.queueNextVerses(
    body.projectUnitId,
    body.bibleId,
    body.bookCode,
    body.chapterNumber,
    body.currentVerse,
    body.lookahead
  );
  if (result.ok) {
    logger.debug({ msg: '[AI Suggestions] POST queue-next OK' });
    return c.json({ message: 'Queued' }, HttpStatusCodes.OK);
  }

  logger.debug({ msg: '[AI Suggestions] POST queue-next ERROR', error: result.error.message });
  return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
});
