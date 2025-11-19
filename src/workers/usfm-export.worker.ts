/* eslint-disable node/prefer-global/buffer */
import type { Job } from 'bullmq';

import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import Redis from 'ioredis';

import type { USFMExportJobData } from '@/lib/queue.config';

import { db } from '@/db';
import { usfmExportJobs } from '@/db/schema';
import { createUSFMZipStreamAsync, getProjectName } from '@/domains/usfm/usfm.handlers';
import { logger } from '@/lib/logger';

// Redis connection for worker
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Create worker - NO DISK STORAGE
const worker = new Worker<USFMExportJobData>(
  'usfm-exports',
  async (job: Job<USFMExportJobData>) => {
    const { projectUnitId, bookIds } = job.data;

    logger.info('Processing export job', { jobId: job.id, projectUnitId, bookIds });

    try {
      // Update status to processing
      await db
        .update(usfmExportJobs)
        .set({ status: 'processing', startedAt: new Date() })
        .where(eq(usfmExportJobs.jobId, job.id!));

      await job.updateProgress(10);

      // Get project name
      const projectName = await getProjectName(projectUnitId);
      const filename = `${projectName?.trim().replace(/[<>:"/\\|?*]/g, '_') || 'export'}.zip`;

      await job.updateProgress(20);

      // Create ZIP stream
      const exportResult = await createUSFMZipStreamAsync(projectUnitId, bookIds);

      if (!exportResult) {
        throw new Error('No books available for export');
      }

      const { stream: zipStream, cleanup } = exportResult;

      await job.updateProgress(30);

      // Collect stream into buffer (IN MEMORY)
      const chunks: Buffer[] = [];
      let fileSize = 0;
      let lastProgress = 30;

      zipStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        fileSize += chunk.length;

        // Throttle progress updates (every 5%)
        const currentProgress = Math.min(30 + Math.floor((fileSize / (1024 * 1024)) * 10), 90);
        if (currentProgress >= lastProgress + 5) {
          job.updateProgress(currentProgress);
          lastProgress = currentProgress;
        }
      });

      // Wait for stream to complete
      await new Promise<void>((resolve, reject) => {
        zipStream.on('end', resolve);
        zipStream.on('error', reject);
      });

      cleanup();

      await job.updateProgress(95);

      // Combine all chunks into single buffer
      const fileBuffer = Buffer.concat(chunks);

      // Store in Redis with 1 hour TTL (auto-expires)
      const base64Data = fileBuffer.toString('base64');
      await redisConnection.setex(
        `export:file:${job.id}`,
        3600, // 1 hour in seconds
        base64Data
      );

      // Calculate expiry time
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      // Update database - NO file_path!
      await db
        .update(usfmExportJobs)
        .set({
          status: 'completed',
          progress: 100,
          filename,
          fileSize,
          completedAt: new Date(),
          expiresAt,
        })
        .where(eq(usfmExportJobs.jobId, job.id!));

      await job.updateProgress(100);

      logger.info('Export job completed (stored in Redis)', {
        jobId: job.id,
        fileSize,
        filename,
        expiresIn: '1 hour',
      });

      return { filename, fileSize, storage: 'redis' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Export job failed', { jobId: job.id, error: errorMessage });

      await db
        .update(usfmExportJobs)
        .set({
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
        })
        .where(eq(usfmExportJobs.jobId, job.id!));

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 60000,
    },
  }
);

// Event listeners
worker.on('completed', (job) => {
  logger.info('Worker completed job', { jobId: job.id });
});

worker.on('failed', (job, err) => {
  logger.error('Worker job failed', { jobId: job?.id, error: err.message });
});

worker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
});

logger.info('USFM export worker started (Redis storage)', {
  concurrency: 3,
  storage: 'Redis (memory-only)',
  ttl: '1 hour',
});
