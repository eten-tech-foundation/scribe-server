import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { insertTranslatedVersesSchema, selectTranslatedVersesSchema } from '@/db/schema';
import { requireUserAccess } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as translatedVersesHandler from './translated-verses.handlers';

server.use('/projects/translated-verses/*', requireUserAccess);

const getTranslatedVersesByProjectBookChapterRoute = createRoute({
  tags: ['Projects - Translated Verses'],
  method: 'get',
  path: '/projects/translated-verses/{projectUnitId}/{bookId}/{chapterNumber}',
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
      bookId: z.coerce
        .number()
        .int()
        .openapi({
          param: {
            name: 'bookId',
            in: 'path',
            required: true,
            allowReserved: false,
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
            in: 'path',
            required: true,
            allowReserved: false,
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

server.openapi(getTranslatedVersesByProjectBookChapterRoute, async (c) => {
  const { projectUnitId, bookId, chapterNumber } = c.req.valid('param');

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

const getTranslatedVerseRoute = createRoute({
  tags: ['Projects - Translated Verses'],
  method: 'get',
  path: '/projects/translated-verses/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        description: 'Translated verse ID',
        example: 77,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTranslatedVersesSchema, 'The translated verse'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Translated verse not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Access denied'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get a translated verse by ID',
  description: 'Returns a single translated verse by its translated_verses.id',
});

server.openapi(getTranslatedVerseRoute, async (c) => {
  const { id } = c.req.valid('param');

  const result = await translatedVersesHandler.getTranslatedVerseById(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message === 'Translated verse not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

const upsertTranslatedVerseRoute = createRoute({
  tags: ['Projects - Translated Verses'],
  method: 'post',
  path: '/projects/translated-verses',
  request: {
    body: jsonContent(insertTranslatedVersesSchema, 'The translated verse to create or update'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectTranslatedVersesSchema,
      'The created or updated translated verse'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Validation error or constraint violation'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Access denied'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.object({
        success: z.boolean(),
        error: z.object({
          issues: z.array(
            z.object({
              code: z.string(),
              path: z.array(z.string()),
              message: z.string(),
            })
          ),
          name: z.string(),
        }),
      }),
      'The validation error'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Create or update a translated verse',
  description:
    'Creates a new translated verse or updates existing one if it already exists for the same project unit and bible text',
});

server.openapi(upsertTranslatedVerseRoute, async (c) => {
  const translatedVerseData = c.req.valid('json');
  const currentUser = c.get('user');

  if (!translatedVerseData.assignedUserId) {
    translatedVerseData.assignedUserId = currentUser!.id;
  }

  const result = await translatedVersesHandler.upsertTranslatedVerse(translatedVerseData);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
});
