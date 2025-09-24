import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { server } from '@/server/server';

import * as bibleTextsHandler from './bible-texts.handlers';

const bibleTextSchema = z.object({
  id: z.number().int(),
  chapterNumber: z.number().int(),
  verseNumber: z.number().int(),
  text: z.string(),
});

const getBibleTextsByChapterRoute = createRoute({
  tags: ['Bible Texts'],
  method: 'get',
  path: '/bibles/{bibleId}/books/{bookId}/chapters/{chapterNumber}/texts',
  request: {
    params: z.object({
      bibleId: z.coerce
        .number()
        .int()
        .min(1)
        .openapi({
          param: {
            name: 'bibleId',
            in: 'path',
            required: true,
            allowReserved: false,
          },
          description: 'Bible ID',
          example: 1,
        }),
      bookId: z.coerce
        .number()
        .int()
        .min(1)
        .openapi({
          param: {
            name: 'bookId',
            in: 'path',
            required: true,
            allowReserved: false,
          },
          description: 'Book ID',
          example: 1,
        }),
      chapterNumber: z.coerce
        .number()
        .int()
        .min(1)
        .openapi({
          param: {
            name: 'chapterNumber',
            in: 'path',
            required: true,
            allowReserved: false,
          },
          description: 'Chapter number',
          example: 1,
        }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      bibleTextSchema.array().openapi('BibleTexts'),
      'The list of bible texts for the chapter'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Invalid parameters'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Bible, book, or chapter not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get bible texts by chapter',
  description: 'Returns a list of bible texts for a specific bible, book, and chapter',
});

server.openapi(getBibleTextsByChapterRoute, async (c) => {
  const { bibleId, bookId, chapterNumber } = c.req.valid('param');

  const result = await bibleTextsHandler.getBibleTextsByChapter(bibleId, bookId, chapterNumber);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message.includes('not found')) {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
