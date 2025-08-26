import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { insertBiblesSchema, patchBiblesSchema, selectBiblesSchema } from '@/db/schema';
import { server } from '@/server/server';

import * as bibleHandler from './bibles.handlers';

const listBiblesRoute = createRoute({
  tags: ['Bibles'],
  method: 'get',
  path: '/bibles',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectBiblesSchema.array().openapi('Bibles'),
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
  const result = await bibleHandler.getAllBibles();

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const getBibleByIdRoute = createRoute({
  tags: ['Bibles'],
  method: 'get',
  path: '/bibles/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectBiblesSchema.openapi('Bible'), 'The requested bible'),
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
  const result = await bibleHandler.getBibleById(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message === 'Bible not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const createBibleRoute = createRoute({
  tags: ['Bibles'],
  method: 'post',
  path: '/bibles',
  request: {
    body: jsonContentRequired(insertBiblesSchema, 'The bible to create'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectBiblesSchema.openapi('Bible'),
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
  const bibleData = c.req.valid('json');
  const result = await bibleHandler.createBible(bibleData);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.CREATED);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const updateBibleRoute = createRoute({
  tags: ['Bibles'],
  method: 'patch',
  path: '/bibles/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    body: jsonContentRequired(patchBiblesSchema, 'The bible data to update'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectBiblesSchema.openapi('Bible'), 'The updated bible'),
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
  const bibleData = c.req.valid('json');
  const result = await bibleHandler.updateBible(id, bibleData);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message === 'Bible not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const deleteBibleRoute = createRoute({
  tags: ['Bibles'],
  method: 'delete',
  path: '/bibles/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createMessageObjectSchema('Bible deleted successfully'),
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
  const result = await bibleHandler.deleteBible(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message === 'Bible not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
