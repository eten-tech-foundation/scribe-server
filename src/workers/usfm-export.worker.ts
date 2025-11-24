import type {PgBoss} from 'pg-boss';

import { Buffer } from 'node:buffer';

import type { USFMExportJob } from '@/lib/queue';

import { createUSFMZipStreamAsync } from '@/domains/usfm/usfm.handlers';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES } from '@/lib/queue';

interface JobPayload {
  id: string;
  data: USFMExportJob;
}

export async function registerUSFMExportWorker(boss: PgBoss): Promise<void> {
  await boss.work<USFMExportJob>(
    QUEUE_NAMES.USFM_EXPORT,
    async (jobInput: JobPayload | JobPayload[]) => {
      const job: JobPayload = Array.isArray(jobInput) ? jobInput[0] : jobInput;
      
      const { projectUnitId, bookIds, requestedBy } = job.data;

      logger.info('Starting USFM export job', {
        jobId: job.id,
        projectUnitId,
        bookIds,
        requestedBy,
      });

      try {
        const exportResult = await createUSFMZipStreamAsync(projectUnitId, bookIds);

        if (!exportResult) {
          throw new Error('No books available for export');
        }

        const { stream, cleanup } = exportResult;

        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }

        const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

        cleanup();

        logger.info('USFM export job completed', {
          jobId: job.id,
          projectUnitId,
          bookIds,
          sizeBytes: totalSize,
        });

        return {
          success: true,
          projectUnitId,
          bookIds,
          sizeBytes: totalSize,
        };
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        logger.error('USFM export job failed', {
          jobId: job.id,
          projectUnitId,
          bookIds,
          error: errorMessage,
        });

        throw error;
      }
    }
  );

  logger.info('USFM export worker registered');
}