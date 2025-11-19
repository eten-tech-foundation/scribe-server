import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

import { logger } from './logger';

// Redis connection
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Export job data interface
export interface USFMExportJobData {
  projectUnitId: number;
  bookIds?: number[];
  userId?: string;
  requestedAt: Date;
}

// Create export queue
export const usfmExportQueue = new Queue<USFMExportJobData>('usfm-exports', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // 24 hours
      count: 100,
    },
    removeOnFail: {
      age: 604800, // 7 days
    },
  },
});

// Queue events for monitoring
export const usfmQueueEvents = new QueueEvents('usfm-exports', {
  connection: redisConnection,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Closing queue connections...');
  await usfmExportQueue.close();
  await redisConnection.quit();
});

logger.info('USFM export queue initialized');
