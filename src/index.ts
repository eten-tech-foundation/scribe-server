import 'dotenv/config';
import { serve } from '@hono/node-server';

import env from '@/env';
import { logger } from '@/lib/logger';
import { initializeQueue, QUEUE_NAMES, stopQueue } from '@/lib/queue';
import { registerUSFMExportWorker } from '@/workers/usfm-export.worker';

import app from './app';

async function startServer() {
  try {
    // Initialize queue system
    logger.info('Initializing queue system...');
    const boss = await initializeQueue();
    
    // CREATE THE QUEUE FIRST (this was missing!)
    logger.info('Creating USFM export queue...');
    await boss.createQueue(QUEUE_NAMES.USFM_EXPORT, {
      retryLimit: 3,
      retryDelay: 60,
      retryBackoff: true,
      expireInSeconds: 3600,
    });
    logger.info('Queue created successfully');
    
    // Register workers AFTER queue is created
    logger.info('Registering queue workers...');
    await registerUSFMExportWorker(boss);
    
    // Start HTTP server
    const server = serve({
      fetch: app.fetch,
      port: env.PORT,
    });

    logger.info(`Server is running on http://localhost:${env.PORT}`);

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      
      try {
        server.close(() => {
          logger.info('HTTP server closed');
        });
        
        await stopQueue();
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start server:', { error });
    process.exit(1);
  }
}

startServer();