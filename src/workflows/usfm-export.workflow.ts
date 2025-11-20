/* eslint-disable node/prefer-global/buffer */
import { DBOS } from '@dbos-inc/dbos-sdk';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { usfmExportJobs } from '@/db/schema';
import { createUSFMZipStreamAsync, getProjectName } from '@/domains/usfm/usfm.handlers';
import { logger } from '@/lib/logger';

/**
 * Step 1: Initialize job in database
 */
async function initializeJob(workflowId: string, projectUnitId: number, bookIds?: number[]) {
  logger.info('Initializing export job', { workflowId, projectUnitId, bookIds });

  await db.insert(usfmExportJobs).values({
    workflowId,
    projectUnitId,
    bookIds: bookIds || null,
    status: 'pending',
  });

  return { initialized: true };
}

/**
 * Step 2: Generate and store ZIP file
 */
async function generateAndStoreZip(
  workflowId: string,
  projectUnitId: number,
  bookIds?: number[]
) {
  logger.info('Generating ZIP file', { workflowId, projectUnitId });

  // Update status to processing
  await db
    .update(usfmExportJobs)
    .set({ status: 'processing', progress: 10 })
    .where(eq(usfmExportJobs.workflowId, workflowId));

  // Get project name
  const projectName = await getProjectName(projectUnitId);
  if (!projectName) {
    throw new Error('Project not found');
  }

  await db
    .update(usfmExportJobs)
    .set({ progress: 20, projectName })
    .where(eq(usfmExportJobs.workflowId, workflowId));

  // Create ZIP stream
  const exportResult = await createUSFMZipStreamAsync(projectUnitId, bookIds);
  if (!exportResult) {
    throw new Error('No books available for export');
  }

  const { stream: zipStream, cleanup } = exportResult;

  await db
    .update(usfmExportJobs)
    .set({ progress: 50 })
    .where(eq(usfmExportJobs.workflowId, workflowId));

  // Collect stream into buffer
  const chunks: Buffer[] = [];

  zipStream.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  // Wait for stream to complete
  await new Promise<void>((resolve, reject) => {
    zipStream.on('end', resolve);
    zipStream.on('error', reject);
  });

  cleanup();

  // Combine chunks into single buffer
  const fileBuffer = Buffer.concat(chunks);
  const fileSize = fileBuffer.length;
  const base64Data = fileBuffer.toString('base64');

  await db
    .update(usfmExportJobs)
    .set({ progress: 80 })
    .where(eq(usfmExportJobs.workflowId, workflowId));

  // Store in database
  const filename = `${projectName.trim().replace(/[<>:"/\\|?*]/g, '_')}.zip`;

  await db
    .update(usfmExportJobs)
    .set({
      status: 'completed',
      progress: 100,
      filename,
      fileData: base64Data,
      fileSize,
      completedAt: new Date(),
    })
    .where(eq(usfmExportJobs.workflowId, workflowId));

  logger.info('Export completed successfully', { workflowId, fileSize, filename });

  return { filename, fileSize };
}

/**
 * Main DBOS Workflow - USFM Export
 */
export const usfmExportWorkflow = DBOS.registerWorkflow(
  async (workflowId: string, projectUnitId: number, bookIds?: number[]) => {
    logger.info('🚀 Starting USFM export workflow', { workflowId, projectUnitId, bookIds });

    try {
      // Step 1: Initialize job (idempotent)
      await DBOS.runStep(
        () => initializeJob(workflowId, projectUnitId, bookIds),
        { name: 'initialize' }
      );

      // Step 2: Generate and store ZIP (idempotent)
      const result = await DBOS.runStep(
        () => generateAndStoreZip(workflowId, projectUnitId, bookIds),
        { name: 'generateZip' }
      );

      logger.info('✅ Workflow completed successfully', { workflowId, result });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('❌ Workflow failed', { workflowId, error: errorMessage });

      // Mark job as failed
      await db
        .update(usfmExportJobs)
        .set({
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
        })
        .where(eq(usfmExportJobs.workflowId, workflowId));

      throw error;
    }
  },
  { name: 'usfmExportWorkflow' }
);