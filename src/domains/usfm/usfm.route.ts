/* eslint-disable node/prefer-global/buffer */
import { createRoute, z } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import { stream } from 'hono/streaming';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';

import { db } from '@/db';
import { usfmExportJobs } from '@/db/schema';
import { DBOS } from '@/lib/dbos.config';
import { logger } from '@/lib/logger';
import { server } from '@/server/server';
import { usfmExportWorkflow } from '@/workflows/usfm-export.workflow';

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

// NEW: Background export schemas
const backgroundExportRequestSchema = z.object({
  bookIds: z.array(z.number().int().positive()).optional(),
});

const backgroundExportResponseSchema = z.object({
  workflowId: z.string(),
  statusUrl: z.string(),
});

const jobStatusResponseSchema = z.object({
  workflowId: z.string(),
  status: z.string(),
  progress: z.number().int(),
  filename: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  projectName: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  downloadUrl: z.string().nullable(),
});

// ============================================================================
// ROUTE DEFINITIONS
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

// NEW: Background export route
const startBackgroundExportRoute = createRoute({
  tags: ['USFM Export'],
  method: 'post',
  path: '/project-units/{projectUnitId}/usfm/background-export',
  request: {
    params: projectUnitIdParam,
    body: jsonContent(backgroundExportRequestSchema, 'Book selection for background export'),
  },
  responses: {
    [HttpStatusCodes.ACCEPTED]: jsonContent(backgroundExportResponseSchema, 'Export started'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Bad request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Project not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
});

// NEW: Get job status route
const getJobStatusRoute = createRoute({
  tags: ['USFM Export'],
  method: 'get',
  path: '/usfm/jobs/{workflowId}',
  request: {
    params: z.object({ workflowId: z.string() }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(jobStatusResponseSchema, 'Job status'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Job not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
});

// NEW: Download job route
const downloadJobRoute = createRoute({
  tags: ['USFM Export'],
  method: 'get',
  path: '/usfm/jobs/{workflowId}/download',
  request: {
    params: z.object({ workflowId: z.string() }),
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
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Export not found'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Export not ready'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(errorSchema, 'Internal server error'),
  },
});

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

// EXISTING: Get exportable books
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

// EXISTING: Stream export (immediate download)
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

// NEW: Start background export
server.openapi(startBackgroundExportRoute, async (c) => {
  const { projectUnitId } = c.req.valid('param');
  const { bookIds } = c.req.valid('json');

  try {
    // Validate book IDs if provided
    if (bookIds && !(await validateBookIds(projectUnitId, bookIds))) {
      logger.warn('Invalid book IDs provided for background export', { projectUnitId, bookIds });
      return c.json(
        {
          error: 'Invalid book IDs',
          details: 'One or more book IDs do not belong to this project unit',
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Check if project exists
    const projectName = await getProjectName(projectUnitId);
    if (!projectName) {
      logger.warn('Project not found for background export', { projectUnitId });
      return c.json(
        { error: 'Project not found for this project unit' },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Generate unique workflow ID
    const workflowId = `export-${projectUnitId}-${Date.now()}`;

    logger.info('Starting background export', { workflowId, projectUnitId, bookIds });

    // Start DBOS workflow (non-blocking)
    const handle = await DBOS.startWorkflow(usfmExportWorkflow, {
      workflowID: workflowId,
    })(workflowId, projectUnitId, bookIds);

    logger.info('Background export workflow started', {
      workflowId: handle.workflowID,
      projectUnitId,
    });

    return c.json(
      {
        workflowId: handle.workflowID,
        statusUrl: `/api/usfm/jobs/${handle.workflowID}`,
      },
      HttpStatusCodes.ACCEPTED
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to start background export', { error: errorMessage, projectUnitId });

    return c.json(
      { error: 'Failed to start export', details: errorMessage },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

// NEW: Get job status
server.openapi(getJobStatusRoute, async (c) => {
  const { workflowId } = c.req.valid('param');

  try {
    const [job] = await db
      .select()
      .from(usfmExportJobs)
      .where(eq(usfmExportJobs.workflowId, workflowId));

    if (!job) {
      logger.warn('Job status requested for non-existent job', { workflowId });
      return c.json({ error: 'Export job not found' }, HttpStatusCodes.NOT_FOUND);
    }

    logger.debug('Job status retrieved', {
      workflowId,
      status: job.status,
      progress: job.progress,
    });

    return c.json(
      {
        workflowId: job.workflowId,
        status: job.status,
        progress: job.progress ?? 0,
        filename: job.filename,
        fileSize: job.fileSize,
        projectName: job.projectName,
        error: job.error,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
        downloadUrl: job.status === 'completed' ? `/api/usfm/jobs/${workflowId}/download` : null,
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get job status', { error: errorMessage, workflowId });

    return c.json(
      { error: 'Failed to get job status', details: errorMessage },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

// NEW: Download completed export
server.openapi(downloadJobRoute, async (c) => {
  const { workflowId } = c.req.valid('param');

  try {
    const [job] = await db
      .select()
      .from(usfmExportJobs)
      .where(eq(usfmExportJobs.workflowId, workflowId));

    if (!job) {
      logger.warn('Download requested for non-existent job', { workflowId });
      return c.json({ error: 'Export not found' }, HttpStatusCodes.NOT_FOUND);
    }

    if (job.status !== 'completed') {
      logger.warn('Download requested for incomplete job', {
        workflowId,
        status: job.status,
      });
      return c.json(
        {
          error: 'Export not ready',
          details: `Current status: ${job.status}. Please wait for completion.`,
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!job.fileData) {
      logger.error('File data missing for completed job', { workflowId });
      return c.json(
        {
          error: 'File data not available',
          details: 'The export file is missing. Please create a new export.',
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    logger.info('Serving export file', {
      workflowId,
      filename: job.filename,
      fileSize: job.fileSize,
    });

    // Convert base64 back to buffer
    const fileBuffer = Buffer.from(job.fileData, 'base64');

    // Set response headers
    c.header('Content-Type', 'application/zip');
    c.header('Content-Disposition', `attachment; filename="${job.filename}"`);
    c.header('Content-Length', fileBuffer.length.toString());
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');

    return c.body(fileBuffer);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Download failed', { error: errorMessage, workflowId });

    return c.json(
      { error: 'Download failed', details: errorMessage },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

export {
  downloadJobRoute,
  exportProjectUSFMRoute,
  getExportableBooksRoute,
  getJobStatusRoute,
  startBackgroundExportRoute,
};
