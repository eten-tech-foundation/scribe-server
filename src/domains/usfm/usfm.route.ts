import { createRoute, z } from '@hono/zod-openapi';
import { stream } from 'hono/streaming';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';

import { logger } from '@/lib/logger';
import { server } from '@/server/server';

import {
  createUSFMZipStreamAsync,
  getAvailableBooksForExport,
  getProjectName,
  validateBookIds,
} from './usfm.handlers';

const projectUnitIdParam = z.object({
  projectUnitId: z.coerce.number().int().positive(),
});

const bookInfoSchema = z.object({
  bookId: z.number().int(),
  bookCode: z.string(),
  bookName: z.string(),
  verseCount: z.number().int(),
  translatedCount: z.number().int(),
});

const exportableBooksResponseSchema = z.object({
  projectUnitId: z.number().int(),
  books: z.array(bookInfoSchema),
  totalBooks: z.number().int(),
});

const exportRequestBodySchema = z.object({
  bookIds: z.array(z.number().int().positive()).optional(),
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
    [HttpStatusCodes.OK]: jsonContent(exportableBooksResponseSchema, 'Success'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Error'),
  },
});

const exportProjectUSFMRoute = createRoute({
  tags: ['USFM Export'],
  method: 'post',
  path: '/project-units/{projectUnitId}/usfm',
  request: {
    params: projectUnitIdParam,
    body: jsonContent(exportRequestBodySchema, 'Book selection'),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: 'ZIP file',
      content: {
        'application/zip': {
          schema: { type: 'string', format: 'binary' },
        },
      },
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Bad request'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Error'),
  },
});

server.openapi(getExportableBooksRoute, async (c) => {
  try {
    const { projectUnitId } = c.req.valid('param');
    const books = await getAvailableBooksForExport(projectUnitId);

    return c.json(
      {
        projectUnitId,
        books,
        totalBooks: books.length,
      },
      HttpStatusCodes.OK
    );
  } catch (error: unknown) {
    logger.error('Get Exportable Books Error:', {
      error,
      projectUnitId: c.req.param('projectUnitId'),
    });

    return c.json(
      {
        error: 'Failed to get exportable books',
        details: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

server.openapi(exportProjectUSFMRoute, async (c) => {
  const { projectUnitId } = c.req.valid('param');
  const { bookIds } = c.req.valid('json');

  try {
    if (bookIds) {
      const areValidBooks = await validateBookIds(projectUnitId, bookIds);
      if (!areValidBooks) {
        return c.json(
          {
            error: 'Invalid book IDs',
            details: 'One or more book IDs do not belong to this project unit',
          },
          HttpStatusCodes.BAD_REQUEST
        );
      }
    }

    const projectName = await getProjectName(projectUnitId);

    if (!projectName) {
      return c.json(
        { error: 'Project not found for this project unit' },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const exportResult = await createUSFMZipStreamAsync(projectUnitId, bookIds);

    if (!exportResult) {
      return c.json({ error: 'No books available for export' }, HttpStatusCodes.BAD_REQUEST);
    }

    const { stream: zipStream, cleanup } = exportResult;

    const filename = `${projectName.trim().replace(/[<>:"/\\|?*]/g, '_')}.zip`;

    c.header('Content-Type', 'application/zip');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);

    let cleanupExecuted = false;

    const performCleanup = () => {
      if (cleanupExecuted) {
        return;
      }
      cleanupExecuted = true;

      cleanup();
      if (!zipStream.destroyed) {
        zipStream.destroy();
      }
      logger.info('Stream cleanup completed', { projectUnitId, bookIds });
    };

    zipStream.on('error', (err: Error) => {
      logger.error('Stream error during USFM export:', {
        error: err,
        projectUnitId,
        bookIds,
      });
      performCleanup();
    });

    c.req.raw.signal.addEventListener('abort', () => {
      logger.info('Client disconnected during USFM export', { projectUnitId, bookIds });
      performCleanup();
    });

    return stream(c, async (streamWriter) => {
      try {
        for await (const chunk of zipStream) {
          await streamWriter.write(chunk);
        }
      } catch (error) {
        logger.error('Error writing stream chunks:', { error, projectUnitId, bookIds });
        throw error;
      } finally {
        performCleanup();
      }
    });
  } catch (error: unknown) {
    logger.error('USFM Export Error:', {
      error,
      projectUnitId,
      bookIds,
    });

    return c.json(
      {
        error: 'Failed to export USFM',
        details: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});
