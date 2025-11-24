import { createRoute, z } from '@hono/zod-openapi';
import { stream } from 'hono/streaming';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';

import type { USFMExportJob } from '@/lib/queue';

import { logger } from '@/lib/logger';
import { getQueue, QUEUE_NAMES } from '@/lib/queue';
import { server } from '@/server/server';

import {
  createUSFMZipStreamAsync,
  getAvailableBooksForExport,
  getProjectName,
  validateBookIds,
} from './usfm.handlers';

interface ErrorResponse {
  error: string;
  details?: string;
}

// ============================================================================
// Schemas
// ============================================================================

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

const exportAsyncResponseSchema = z.object({
  jobId: z.string(),
  message: z.string(),
});

const jobStatusResponseSchema = z.object({
  id: z.string(),
  state: z.string(),
  data: z.any().optional(),
  output: z.any().optional(),
});

// ============================================================================
// Route Definitions
// ============================================================================

const getExportableBooksRoute = createRoute({
  tags: ['USFM Export'],
  method: 'get',
  path: '/project-units/{projectUnitId}/usfm/books',
  request: {
    params: projectUnitIdParam,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(exportableBooksResponseSchema, 'List of exportable books'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
});

const exportProjectUSFMRoute = createRoute({
  tags: ['USFM Export'],
  method: 'post',
  path: '/project-units/{projectUnitId}/usfm',
  request: {
    params: projectUnitIdParam,
    body: jsonContent(exportRequestBodySchema, 'Book selection for export'),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: 'ZIP file stream',
      content: {
        'application/zip': {
          schema: { type: 'string', format: 'binary' },
        },
      },
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Project not found'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Bad request'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
});

const exportProjectUSFMAsyncRoute = createRoute({
  tags: ['USFM Export'],
  method: 'post',
  path: '/project-units/{projectUnitId}/usfm/async',
  request: {
    params: projectUnitIdParam,
    body: jsonContent(exportRequestBodySchema, 'Book selection for export'),
  },
  responses: {
    [HttpStatusCodes.ACCEPTED]: jsonContent(
      exportAsyncResponseSchema,
      'Export job queued'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Bad request'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
});

const getJobStatusRoute = createRoute({
  tags: ['USFM Export'],
  method: 'get',
  path: '/jobs/{jobId}',
  request: {
    params: z.object({
      jobId: z.string(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(jobStatusResponseSchema, 'Job status'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Job not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
});

// ============================================================================
// Route Handlers
// ============================================================================

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Get exportable books error', {
      error: errorMessage,
      projectUnitId: c.req.param('projectUnitId'),
    });

    const errorResponse: ErrorResponse = {
      error: 'Failed to get exportable books',
      details: errorMessage,
    };

    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
});

server.openapi(exportProjectUSFMRoute, async (c) => {
  const { projectUnitId } = c.req.valid('param');
  const { bookIds } = c.req.valid('json');

  try {
    if (bookIds && !(await validateBookIds(projectUnitId, bookIds))) {
      logger.warn('Invalid book IDs provided for export', { projectUnitId, bookIds });
      return c.json(
        {
          error: 'Invalid book IDs',
          details: 'One or more book IDs do not belong to this project unit',
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const projectName = await getProjectName(projectUnitId);
    if (!projectName) {
      logger.warn('Project not found for project unit', { projectUnitId });
      return c.json(
        { error: 'Project not found for this project unit' },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const exportResult = await createUSFMZipStreamAsync(projectUnitId, bookIds);
    if (!exportResult) {
      logger.warn('No books available for export', { projectUnitId, bookIds });
      return c.json({ error: 'No books available for export' }, HttpStatusCodes.BAD_REQUEST);
    }

    const { stream: zipStream, cleanup } = exportResult;
    const filename = `${projectName.trim().replace(/[<>:"/\\|?*]/g, '_')}.zip`;

    c.header('Content-Type', 'application/zip');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');

    let cleanupExecuted = false;

    const performCleanup = () => {
      if (cleanupExecuted) return;
      cleanupExecuted = true;
      cleanup();
      if (!zipStream.destroyed) {
        zipStream.destroy();
      }
    };

    zipStream.on('error', (err: Error) => {
      logger.error('Stream error during export', { error: err.message, projectUnitId, bookIds });
      performCleanup();
    });

    c.req.raw.signal.addEventListener('abort', () => {
      logger.info('Client aborted export', { projectUnitId, bookIds });
      performCleanup();
    });

    return stream(c, async (streamWriter) => {
      try {
        for await (const chunk of zipStream) {
          await streamWriter.write(chunk);
        }
        logger.info('USFM export completed successfully', { projectUnitId, bookIds });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error writing stream chunks', {
          error: errorMessage,
          projectUnitId,
          bookIds,
        });
        throw error;
      } finally {
        performCleanup();
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('USFM export error', { error: errorMessage, projectUnitId, bookIds });

    return c.json(
      {
        error: 'Failed to export USFM',
        details: errorMessage,
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

server.openapi(exportProjectUSFMAsyncRoute, async (c) => {
  const { projectUnitId } = c.req.valid('param');
  const { bookIds } = c.req.valid('json');

  try {
    if (bookIds && !(await validateBookIds(projectUnitId, bookIds))) {
      return c.json(
        {
          error: 'Invalid book IDs',
          details: 'One or more book IDs do not belong to this project unit',
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const boss = await getQueue();
    
    const jobData: USFMExportJob = {
      projectUnitId,
      bookIds,
      requestedBy: 'api-user',
    };

    const jobId = await boss.send(QUEUE_NAMES.USFM_EXPORT, jobData, {
      retryLimit: 3,
      retryDelay: 60,
      expireInSeconds: 3600, // 1 hour
    });

    if (!jobId) {
      throw new Error('Failed to queue job - no job ID returned');
    }

    logger.info('USFM export job queued', { jobId, projectUnitId, bookIds });

    return c.json(
      {
        jobId,
        message: 'Export job queued successfully',
      },
      HttpStatusCodes.ACCEPTED
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to queue USFM export', { error: errorMessage, projectUnitId });

    return c.json(
      {
        error: 'Failed to queue export',
        details: errorMessage,
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

server.openapi(getJobStatusRoute, async (c) => {
  const { jobId } = c.req.valid('param');

  try {
    const boss = await getQueue();
    const job = await boss.getJobById(QUEUE_NAMES.USFM_EXPORT, jobId);

    if (!job) {
      return c.json(
        { 
          error: 'Job not found',
          details: `No job found with ID: ${jobId}`,
        }, 
        HttpStatusCodes.NOT_FOUND
      );
    }

    return c.json(
      {
        id: job.id,
        state: job.state,
        data: job.data,
        output: job.output,
      },
      HttpStatusCodes.OK
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get job status', { error: errorMessage, jobId });

    return c.json(
      { 
        error: 'Failed to get job status', 
        details: errorMessage,
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

// ============================================================================
// Exports
// ============================================================================

export { 
  exportProjectUSFMAsyncRoute, 
  exportProjectUSFMRoute, 
  getExportableBooksRoute,
  getJobStatusRoute,
};