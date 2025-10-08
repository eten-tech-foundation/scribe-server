import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { server } from '@/server/server';

import { exportProjectUSFMHandler, getExportableBooksHandler } from './usfm.handlers';

const projectUnitIdParam = z.object({
  projectUnitId: z.coerce.number().openapi({
    param: {
      name: 'projectUnitId',
      in: 'path',
      required: true,
    },
    description: 'The ID of the project unit',
    example: 24,
  }),
});

const bookInfoSchema = z.object({
  bookId: z.number().openapi({
    description: 'The database ID of the book',
    example: 1,
  }),
  bookCode: z.string().openapi({
    description: 'USFM book code',
    example: 'GEN',
  }),
  bookName: z.string().openapi({
    description: 'English display name of the book',
    example: 'Genesis',
  }),
  verseCount: z.number().openapi({
    description: 'Total number of verses in the book',
    example: 1533,
  }),
  translatedCount: z.number().openapi({
    description: 'Number of verses translated',
    example: 50,
  }),
});

const errorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

const getExportableBooksRoute = createRoute({
  tags: ['USFM Export'],
  method: 'get',
  path: '/project-units/{projectUnitId}/usfm/books',
  request: {
    params: projectUnitIdParam,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        projectUnitId: z.number(),
        books: z.array(bookInfoSchema),
        totalBooks: z.number(),
      }),
      'List of exportable books with translation progress'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Invalid project unit ID'),
      'Invalid request parameters'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
  summary: 'Get exportable books',
  description:
    'Returns books with translated verses for a project unit, including translation progress.',
});

const exportProjectUSFMRoute = createRoute({
  tags: ['USFM Export'],
  method: 'post',
  path: '/project-units/{projectUnitId}/usfm',
  request: {
    params: projectUnitIdParam,
    body: jsonContent(
      z.object({
        bookIds: z
          .array(z.number())
          .optional()
          .openapi({
            description: 'Book IDs to export. Omit to export all books.',
            example: [1, 3],
          }),
      }),
      'Book selection (optional)'
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: 'ZIP file containing USFM files for selected books',
      content: {
        'application/zip': {
          schema: z.instanceof(Blob).openapi({
            type: 'string',
            format: 'binary',
          }),
        },
      },
    },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Invalid parameters or book IDs'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Project not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
  summary: 'Export USFM files',
  description:
    'Exports translated verses as USFM files in a ZIP archive. Each book is saved as {bookCode}.usfm.',
});

server.openapi(getExportableBooksRoute, getExportableBooksHandler);
server.openapi(exportProjectUSFMRoute, exportProjectUSFMHandler);
