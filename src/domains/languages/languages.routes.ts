import { createRoute } from '@hono/zod-openapi';
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
