import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { selectLanguagesSchema } from '@/db/schema';
import { server } from '@/server/server';

import * as languageHandler from './languages.handlers';

const listLanguagesRoute = createRoute({
  tags: ['Languages'],
  method: 'get',
  path: '/languages',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectLanguagesSchema.array().openapi('Languages'),
      'The list of languages'
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
  summary: 'Get all languages',
  description: 'Returns a list of all languages',
});

server.openapi(listLanguagesRoute, async (c) => {
  const result = await languageHandler.getAllLanguages();

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const getLanguageRoute = createRoute({
  tags: ['Languages'],
  method: 'get',
  path: '/languages/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 1,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectLanguagesSchema, 'The language'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Language not found'
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
  summary: 'Get a language by ID',
  description: 'Returns a single language by its ID',
});

server.openapi(getLanguageRoute, async (c) => {
  const { id } = c.req.valid('param');

  const result = await languageHandler.getLanguageById(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message === 'Language not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
