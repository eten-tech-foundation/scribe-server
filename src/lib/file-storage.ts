import type { Buffer } from 'node:buffer';

import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { logger } from './logger';

const EXPORTS_DIR =
  process.env.EXPORTS_DIR ??
  (process.env.HOME ? join(process.env.HOME, 'data', 'exports') : join(process.cwd(), 'exports'));

const FILE_EXPIRY_MS = 3600000;

export async function initializeFileStorage(): Promise<void> {
  try {
    await mkdir(EXPORTS_DIR, { recursive: true });
    logger.info('File storage initialized', { exportsDir: EXPORTS_DIR });
  } catch (error) {
    logger.error('Failed to initialize file storage', { error, exportsDir: EXPORTS_DIR });
    throw error;
  }
}

export async function saveExportFile(
  jobId: string,
  buffer: Buffer
): Promise<{ filename: string; filepath: string; expiresAt: Date }> {
  const filename = `export-${jobId}.zip`;
  const filepath = join(EXPORTS_DIR, filename);

  try {
    await writeFile(filepath, buffer);

    const expiresAt = new Date(Date.now() + FILE_EXPIRY_MS);

    logger.info('Export file saved', {
      filename,
      filepath,
      sizeBytes: buffer.length,
      expiresAt,
    });

    return { filename, filepath, expiresAt };
  } catch (error) {
    logger.error('Failed to save export file', { filename, filepath, error });
    throw error;
  }
}

export async function getExportFile(filename: string): Promise<Buffer> {
  if (!filename.match(/^export-[a-f0-9-]+\.zip$/)) {
    throw new Error('Invalid filename format');
  }

  const filepath = join(EXPORTS_DIR, filename);

  try {
    const buffer = await readFile(filepath);
    logger.info('Export file retrieved', { filename, filepath, sizeBytes: buffer.length });
    return buffer;
  } catch (error) {
    logger.error('Failed to read export file', { filename, filepath, error });
    throw error;
  }
}

export async function deleteExportFile(filename: string): Promise<void> {
  const filepath = join(EXPORTS_DIR, filename);

  try {
    await unlink(filepath);
    logger.info('Export file deleted', { filename, filepath });
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      logger.error('Failed to delete export file', { filename, filepath, error });
    }
  }
}

export async function fileExists(filename: string): Promise<boolean> {
  const filepath = join(EXPORTS_DIR, filename);

  try {
    const stats = await stat(filepath);
    const fileAge = Date.now() - stats.mtimeMs;

    if (fileAge > FILE_EXPIRY_MS) {
      await deleteExportFile(filename);
      return false;
    }

    return true;
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      logger.error('Error checking file existence', { filename, filepath, error });
    }
    return false;
  }
}

export async function cleanupExpiredFiles(): Promise<void> {
  try {
    const fs = await import('node:fs/promises');
    const files = await fs.readdir(EXPORTS_DIR);

    let deletedCount = 0;

    for (const filename of files) {
      if (filename.match(/^export-[a-f0-9-]+\.zip$/)) {
        const filepath = join(EXPORTS_DIR, filename);
        const stats = await stat(filepath);
        const fileAge = Date.now() - stats.mtimeMs;

        if (fileAge > FILE_EXPIRY_MS) {
          await deleteExportFile(filename);
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      logger.info('Cleaned up expired export files', { deletedCount, exportsDir: EXPORTS_DIR });
    }
  } catch (error) {
    logger.error('Failed to cleanup expired files', { error, exportsDir: EXPORTS_DIR });
  }
}
