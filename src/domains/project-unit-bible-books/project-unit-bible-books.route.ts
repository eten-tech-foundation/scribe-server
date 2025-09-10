import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { requireProjectAccess } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as projectUnitsBibleBooksHandler from './project-unit-bible-books.handlers';

const projectBookSchema = z.object({
  bookId: z.number().int(),
  code: z.string(),
  engDisplayName: z.string(),
});

const getProjectBooksRoute = createRoute({
  tags: ['Project Units Bible Books'],
  method: 'get',
  path: '/projects/{id}/books',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 6,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      projectBookSchema.array().openapi('ProjectBooks'),
      'The list of books associated with the project'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Project access required'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get all books for a project',
  description: 'Returns a list of all books associated with a specific project',
});

server.use('/projects/:id/books', requireProjectAccess);

server.openapi(getProjectBooksRoute, async (c) => {
  const { id } = c.req.valid('param');

  const result = await projectUnitsBibleBooksHandler.getBooksByProjectId(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
