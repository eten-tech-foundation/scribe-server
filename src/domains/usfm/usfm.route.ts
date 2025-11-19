/* eslint-disable max-lines */
import { createRoute, z } from '@hono/zod-openapi';
import { desc, eq } from 'drizzle-orm';
import { stream } from 'hono/streaming';
import Redis from 'ioredis';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';

import { db } from '@/db';
import { usfmExportJobs } from '@/db/schema';
import { logger } from '@/lib/logger';
import { usfmExportQueue } from '@/lib/queue.config';
import { server } from '@/server/server';

import {
  createUSFMZipStreamAsync,
  getAvailableBooksForExport,
  getProjectName,
  validateBookIds,
} from './usfm.handlers';

const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

interface ErrorResponse {
  error: string;
  details?: string;
}

// ============================================================================
// SCHEMAS
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

// ============================================================================
// ROUTE DEFINITIONS - Existing
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

// ============================================================================
// ROUTE DEFINITIONS - New (Background Export)
// ============================================================================

const createBackgroundExportRoute = createRoute({
  tags: ['USFM Export'],
  method: 'post',
  path: '/project-units/{projectUnitId}/usfm/background-export',
  request: {
    params: projectUnitIdParam,
    body: jsonContent(exportRequestBodySchema, 'Book selection for export'),
  },
  responses: {
    [HttpStatusCodes.ACCEPTED]: jsonContent(
      z.object({
        jobId: z.string(),
        message: z.string(),
        statusUrl: z.string(),
      }),
      'Export job created and queued'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Project not found'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Bad request'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
});

const getJobStatusRoute = createRoute({
  tags: ['USFM Export'],
  method: 'get',
  path: '/usfm/jobs/{jobId}',
  request: {
    params: z.object({
      jobId: z.string(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        jobId: z.string(),
        status: z.enum(['pending', 'processing', 'completed', 'failed']),
        progress: z.number().min(0).max(100),
        filename: z.string().optional(),
        fileSize: z.number().optional(),
        error: z.string().optional(),
        projectName: z.string().optional(),
        bookCount: z.number().optional(),
        createdAt: z.string(),
        startedAt: z.string().optional(),
        completedAt: z.string().optional(),
      }),
      'Job status information'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Job not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
});

const downloadJobRoute = createRoute({
  tags: ['USFM Export'],
  method: 'get',
  path: '/usfm/jobs/{jobId}/download',
  request: {
    params: z.object({
      jobId: z.string(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: 'ZIP file download',
      content: {
        'application/zip': {
          schema: { type: 'string', format: 'binary' },
        },
      },
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Export not found or expired'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Export not ready for download'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
});

const listJobsRoute = createRoute({
  tags: ['USFM Export'],
  method: 'get',
  path: '/usfm/jobs',
  request: {
    query: z.object({
      status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
      projectUnitId: z.coerce.number().int().positive().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        jobs: z.array(
          z.object({
            jobId: z.string(),
            projectUnitId: z.number(),
            projectName: z.string().optional(),
            status: z.string(),
            progress: z.number(),
            filename: z.string().optional(),
            fileSize: z.number().optional(),
            bookCount: z.number().optional(),
            createdAt: z.string(),
            completedAt: z.string().optional(),
          })
        ),
        total: z.number(),
      }),
      'List of export jobs'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
});

// ============================================================================
// HANDLERS - Existing Routes
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

// ============================================================================
// HANDLERS - New Background Export Routes
// ============================================================================

server.openapi(createBackgroundExportRoute, async (c) => {
  const { projectUnitId } = c.req.valid('param');
  const { bookIds } = c.req.valid('json');

  try {
    // Validate book IDs
    if (bookIds && !(await validateBookIds(projectUnitId, bookIds))) {
      logger.warn('Invalid book IDs for background export', { projectUnitId, bookIds });
      return c.json(
        {
          error: 'Invalid book IDs',
          details: 'One or more book IDs do not belong to this project unit',
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Check project exists
    const projectName = await getProjectName(projectUnitId);
    if (!projectName) {
      logger.warn('Project not found for project unit', { projectUnitId });
      return c.json(
        { error: 'Project not found for this project unit' },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Add job to Redis queue
    const job = await usfmExportQueue.add(`export-${projectUnitId}-${Date.now()}`, {
      projectUnitId,
      bookIds,
      requestedAt: new Date(),
    });

    // Save to database
    await db.insert(usfmExportJobs).values({
      jobId: job.id!,
      projectUnitId,
      bookIds: bookIds || null,
      projectName,
      bookCount: bookIds?.length || null,
      status: 'pending',
      progress: 0,
    });

    logger.info('Background export job created', { jobId: job.id, projectUnitId, bookIds });

    return c.json(
      {
        jobId: job.id!,
        message: 'Export job created and queued successfully',
        statusUrl: `/api/usfm/jobs/${job.id}`,
      },
      HttpStatusCodes.ACCEPTED
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create background export job', {
      error: errorMessage,
      projectUnitId,
      bookIds,
    });

    return c.json(
      { error: 'Failed to create export job', details: errorMessage },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

server.openapi(getJobStatusRoute, async (c) => {
  const { jobId } = c.req.valid('param');

  try {
    // Get from database
    const [jobRecord] = await db
      .select()
      .from(usfmExportJobs)
      .where(eq(usfmExportJobs.jobId, jobId));

    if (!jobRecord) {
      logger.warn('Job not found', { jobId });
      return c.json({ error: 'Job not found' }, HttpStatusCodes.NOT_FOUND);
    }

    // Get live progress from queue if job is still active
    let currentProgress = jobRecord.progress || 0;
    if (jobRecord.status === 'processing' || jobRecord.status === 'pending') {
      try {
        const job = await usfmExportQueue.getJob(jobId);
        if (job) {
          // Access progress as a property, not a method
          const jobProgress = job.progress;
          currentProgress =
            typeof jobProgress === 'number'
              ? jobProgress
              : typeof jobProgress === 'object' && jobProgress !== null
                ? (jobProgress as any).percent || jobRecord.progress || 0
                : jobRecord.progress || 0;
        }
      } catch (err) {
        // If queue job not found, use database value
        logger.warn('Could not fetch job from queue', { jobId, error: err });
      }
    }

    return c.json(
      {
        jobId: jobRecord.jobId,
        status: jobRecord.status,
        progress: currentProgress,
        filename: jobRecord.filename || undefined,
        fileSize: jobRecord.fileSize || undefined,
        error: jobRecord.error || undefined,
        projectName: jobRecord.projectName || undefined,
        bookCount: jobRecord.bookCount || undefined,
        createdAt: jobRecord.createdAt.toISOString(),
        startedAt: jobRecord.startedAt?.toISOString(),
        completedAt: jobRecord.completedAt?.toISOString(),
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get job status', { error: errorMessage, jobId });

    return c.json(
      { error: 'Failed to get job status', details: errorMessage },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

server.openapi(downloadJobRoute, async (c) => {
  const { jobId } = c.req.valid('param');

  try {
    const [jobRecord] = await db
      .select()
      .from(usfmExportJobs)
      .where(eq(usfmExportJobs.jobId, jobId));

    if (!jobRecord) {
      logger.warn('Download requested for non-existent job', { jobId });
      return c.json({ error: 'Export not found' }, HttpStatusCodes.NOT_FOUND);
    }

    if (jobRecord.status !== 'completed') {
      logger.warn('Download requested for incomplete job', { jobId, status: jobRecord.status });
      return c.json(
        {
          error: 'Export not ready',
          details: `Current status: ${jobRecord.status}. Please wait for completion.`,
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    logger.info('Serving export file from Redis', { jobId, filename: jobRecord.filename });

    // Get file from Redis
    const base64Data = await redisConnection.get(`export:file:${jobId}`);

    if (!base64Data) {
      logger.error('File not found in Redis (expired)', { jobId });
      return c.json(
        {
          error: 'File has expired',
          details:
            'The export is no longer available. Files expire after 1 hour. Please create a new export.',
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Convert base64 back to buffer
    // eslint-disable-next-line node/prefer-global/buffer
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // Delete from Redis immediately after first download
    await redisConnection.del(`export:file:${jobId}`);
    logger.info('Deleted export from Redis after serving', { jobId });

    // Mark as downloaded in database
    await db
      .update(usfmExportJobs)
      .set({ isDownloaded: true })
      .where(eq(usfmExportJobs.jobId, jobId));

    // Set response headers
    c.header('Content-Type', 'application/zip');
    c.header('Content-Disposition', `attachment; filename="${jobRecord.filename}"`);
    c.header('Content-Length', fileBuffer.length.toString());
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');

    // Return the file buffer
    return c.body(fileBuffer);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Download failed', { error: errorMessage, jobId });

    return c.json(
      { error: 'Download failed', details: errorMessage },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

server.openapi(listJobsRoute, async (c) => {
  const query = c.req.valid('query');
  const { status, projectUnitId } = query;

  try {
    let queryBuilder = db.select().from(usfmExportJobs);

    // Apply filters
    const conditions = [];
    if (status) {
      conditions.push(eq(usfmExportJobs.status, status));
    }
    if (projectUnitId) {
      conditions.push(eq(usfmExportJobs.projectUnitId, projectUnitId));
    }

    // Build query with conditions
    if (conditions.length > 0) {
      // For multiple conditions, you'd use 'and' from drizzle-orm
      // For now, apply them sequentially
      for (const condition of conditions) {
        queryBuilder = queryBuilder.where(condition) as typeof queryBuilder;
      }
    }

    // Order by creation time (newest first)
    const jobs = await queryBuilder.orderBy(desc(usfmExportJobs.createdAt));

    // Return simplified job list
    const simplifiedJobs = jobs.map((job) => ({
      jobId: job.jobId,
      projectUnitId: job.projectUnitId,
      projectName: job.projectName || undefined,
      status: job.status,
      progress: job.progress || 0,
      filename: job.filename || undefined,
      fileSize: job.fileSize || undefined,
      bookCount: job.bookCount || undefined,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    }));

    return c.json(
      {
        jobs: simplifiedJobs,
        total: simplifiedJobs.length,
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to list jobs', { error: errorMessage });

    return c.json(
      { error: 'Failed to list jobs', details: errorMessage },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // New Redis queue routes
  createBackgroundExportRoute,
  downloadJobRoute,
  // Existing routes (backward compatible)
  exportProjectUSFMRoute,
  getExportableBooksRoute,
  getJobStatusRoute,
  listJobsRoute,
};
