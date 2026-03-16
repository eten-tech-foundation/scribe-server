import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { insertBiblesSchema, patchBiblesSchema } from '@/db/schema';
import { ErrorCode, ErrorHttpStatus } from '@/lib/types';
import { server } from '@/server/server';

import * as bibleService from './bibles.service';
import { bibleResponseSchema } from './bibles.types';

// ─── GET /bibles ──────────────────────────────────────────────────────────────

const listBiblesRoute = createRoute({
  tags: ['Bibles'],
  method: 'get',
  path: '/bibles',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      bibleResponseSchema.array().openapi('Bibles'),
      'The list of bibles'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get all bibles',
  description: 'Returns a list of all bibles',
});

server.openapi(listBiblesRoute, async (c) => {
  const result = await bibleService.getAllBibles();
  if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
  return c.json(
    { message: result.error.message },
    ErrorHttpStatus[result.error.code ?? ErrorCode.INTERNAL_ERROR] as never
  );
});

// ─── GET /bibles/:id ──────────────────────────────────────────────────────────

const getBibleByIdRoute = createRoute({
  tags: ['Bibles'],
  method: 'get',
  path: '/bibles/{id}',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(bibleResponseSchema.openapi('Bible'), 'The requested bible'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Bible not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get bible by ID',
  description: 'Returns a specific bible by its ID',
});

server.openapi(getBibleByIdRoute, async (c) => {
  const { id } = c.req.valid('param');
  const result = await bibleService.getBibleById(id);
  if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
  return c.json(
    { message: result.error.message },
    ErrorHttpStatus[result.error.code ?? ErrorCode.INTERNAL_ERROR] as never
  );
});

// ─── GET /bibles/language/:languageId ────────────────────────────────────────

const getBiblesByLanguageIdRoute = createRoute({
  tags: ['Bibles'],
  method: 'get',
  path: '/bibles/language/{languageId}',
  request: {
    params: z.object({ languageId: z.coerce.number().int().positive() }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      bibleResponseSchema.array().openapi('Bibles'),
      'List of bibles for the specified language'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get bibles by language ID',
  description: 'Returns a list of bibles for a specific language',
});

server.openapi(getBiblesByLanguageIdRoute, async (c) => {
  const { languageId } = c.req.valid('param');
  const result = await bibleService.getBiblesByLanguageId(languageId);
  if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
  return c.json(
    { message: result.error.message },
    ErrorHttpStatus[result.error.code ?? ErrorCode.INTERNAL_ERROR] as never
  );
});

// ─── POST /bibles ─────────────────────────────────────────────────────────────

const createBibleRoute = createRoute({
  tags: ['Bibles'],
  method: 'post',
  path: '/bibles',
  request: {
    body: jsonContentRequired(insertBiblesSchema, 'The bible to create'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      bibleResponseSchema.openapi('Bible'),
      'The created bible'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.BAD_REQUEST),
      'Invalid request data'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Create a new bible',
  description: 'Creates a new bible with the provided data',
});

server.openapi(createBibleRoute, async (c) => {
  const result = await bibleService.createBible(c.req.valid('json'));
  if (result.ok) return c.json(result.data, HttpStatusCodes.CREATED);
  return c.json(
    { message: result.error.message },
    ErrorHttpStatus[result.error.code ?? ErrorCode.INTERNAL_ERROR] as never
  );
});

// ─── PATCH /bibles/:id ────────────────────────────────────────────────────────

const updateBibleRoute = createRoute({
  tags: ['Bibles'],
  method: 'patch',
  path: '/bibles/{id}',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: jsonContentRequired(patchBiblesSchema, 'The bible data to update'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(bibleResponseSchema.openapi('Bible'), 'The updated bible'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.BAD_REQUEST),
      'Invalid request data'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Bible not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Update bible by ID',
  description: 'Updates a specific bible with the provided data',
});

server.openapi(updateBibleRoute, async (c) => {
  const { id } = c.req.valid('param');
  const result = await bibleService.updateBible(id, c.req.valid('json'));
  if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
  return c.json(
    { message: result.error.message },
    ErrorHttpStatus[result.error.code ?? ErrorCode.INTERNAL_ERROR] as never
  );
});

// ─── DELETE /bibles/:id ───────────────────────────────────────────────────────

const deleteBibleRoute = createRoute({
  tags: ['Bibles'],
  method: 'delete',
  path: '/bibles/{id}',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ id: z.number() }).openapi('DeletedBible'),
      'Bible deletion confirmation'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Bible not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Delete bible by ID',
  description: 'Deletes a specific bible by its ID',
});

server.openapi(deleteBibleRoute, async (c) => {
  const { id } = c.req.valid('param');
  const result = await bibleService.deleteBible(id);
  if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
  return c.json(
    { message: result.error.message },
    ErrorHttpStatus[result.error.code ?? ErrorCode.INTERNAL_ERROR] as never
  );
});
