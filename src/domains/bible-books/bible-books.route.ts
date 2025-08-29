import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { selectBibleBooksSchema } from '@/db/schema';
import { server } from '@/server/server';

import * as bibleBookHandler from './bible-books.handlers';

const bibleBookWithDetailsSchema = selectBibleBooksSchema.extend({
  book: z.object({
    id: z.number(),
    code: z.string(),
    eng_display_name: z.string(),
  }),
  bible: z.object({
    id: z.number(),
    name: z.string(),
  }),
});

const getBibleBooksByBibleRoute = createRoute({
  tags: ['Bible Books'],
  method: 'get',
  path: '/bible-books/bible/{bibleId}',
  request: {
    params: z.object({
      bibleId: z.coerce.number().openapi({
        param: {
          name: 'bibleId',
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
      bibleBookWithDetailsSchema.array().openapi('BibleBooks'),
      'The list of books for this bible'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'No books found for this bible'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get books by bible ID',
  description: 'Returns all books for a specific bible with book and bible details',
});

server.openapi(getBibleBooksByBibleRoute, async (c) => {
  const { bibleId } = c.req.valid('param');

  const result = await bibleBookHandler.getBibleBooksByBibleId(bibleId);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (
    result.error.message.includes('not found') ||
    result.error.message.includes('No Bible Books found')
  ) {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
