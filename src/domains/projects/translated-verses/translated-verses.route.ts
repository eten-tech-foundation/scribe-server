import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { selectTranslatedVersesSchema } from '@/db/schema';
import { requireUserAccess } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as translatedVersesHandler from './translated-verses.handlers';

server.use('/projects/*/translated-verses/*', requireUserAccess);

const getTranslatedVersesByProjectRoute = createRoute({
  tags: ['Projects - Translated Verses'],
  method: 'get',
  path: '/projects/{projectUnitId}/translated-verses',
  request: {
    params: z.object({
      projectUnitId: z.coerce
        .number()
        .int()
        .openapi({
          param: {
            name: 'projectUnitId',
            in: 'path',
            required: true,
            allowReserved: false,
          },
          description: 'Project Unit ID to filter by',
          example: 24,
        }),
    }),
    query: z.object({
      bookId: z.coerce
        .number()
        .int()
        .openapi({
          param: {
            name: 'bookId',
            in: 'query',
            required: true,
          },
          description: 'Book ID to filter by',
          example: 1,
        }),
      chapterNumber: z.coerce
        .number()
        .int()
        .openapi({
          param: {
            name: 'chapterNumber',
            in: 'query',
            required: true,
          },
          description: 'Chapter number to filter by',
          example: 1,
        }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectTranslatedVersesSchema.array().openapi('TranslatedVerses'),
      'The list of translated verses for the project unit, book and chapter'
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
  summary: 'Get translated verses by project unit, book and chapter',
  description:
    'Returns a list of translated verses filtered by project unit ID, book ID and chapter number',
});

server.openapi(getTranslatedVersesByProjectRoute, async (c) => {
  const { projectUnitId } = c.req.valid('param');
  const { bookId, chapterNumber } = c.req.valid('query');

  const result = await translatedVersesHandler.getTranslatedVerses({
    projectUnitId,
    bookId,
    chapterNumber,
  });

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
