import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { selectBooksSchema } from '@/db/schema';
import { server } from '@/server/server';

import * as bookHandler from './books.handlers';

const listBooksRoute = createRoute({
  tags: ['Books'],
  method: 'get',
  path: '/books',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectBooksSchema.array().openapi('Books'),
      'The list of books'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get all books',
  description: 'Returns a list of all books',
});

server.openapi(listBooksRoute, async (c) => {
  const result = await bookHandler.getAllBooks();

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const getOldTestamentBooksRoute = createRoute({
  tags: ['Books'],
  method: 'get',
  path: '/books/old-testament',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectBooksSchema.array().openapi('OldTestamentBooks'),
      'The list of Old Testament books'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get Old Testament books',
  description: 'Returns a list of Old Testament books (39 books)',
});

server.openapi(getOldTestamentBooksRoute, async (c) => {
  const result = await bookHandler.getOldTestamentBooks();

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const getNewTestamentBooksRoute = createRoute({
  tags: ['Books'],
  method: 'get',
  path: '/books/new-testament',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectBooksSchema.array().openapi('NewTestamentBooks'),
      'The list of New Testament books'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get New Testament books',
  description: 'Returns a list of New Testament books (27 books)',
});

server.openapi(getNewTestamentBooksRoute, async (c) => {
  const result = await bookHandler.getNewTestamentBooks();

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const getBookRoute = createRoute({
  tags: ['Books'],
  method: 'get',
  path: '/books/{id}',
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
    [HttpStatusCodes.OK]: jsonContent(selectBooksSchema, 'The book'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Book not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get a book by ID',
  description: 'Returns a single book by their ID',
});

server.openapi(getBookRoute, async (c) => {
  const { id } = c.req.valid('param');

  const result = await bookHandler.getBookById(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message.includes('not found')) {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const getBookByCodeRoute = createRoute({
  tags: ['Books'],
  method: 'get',
  path: '/books/code/{code}',
  request: {
    params: z.object({
      code: z
        .string()
        .min(1, 'Book code is required')
        .max(50, 'Book code cannot exceed 50 characters')
        .openapi({
          param: {
            name: 'code',
            in: 'path',
            required: true,
            allowReserved: false,
          },
          example: 'GEN',
        }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectBooksSchema, 'The book'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Book not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get a book by code',
  description: 'Returns a single book by their code',
});

server.openapi(getBookByCodeRoute, async (c) => {
  const { code } = c.req.valid('param');

  const result = await bookHandler.getBookByCode(code);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message.includes('not found')) {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
