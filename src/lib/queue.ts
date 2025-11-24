import {PgBoss} from 'pg-boss';

import { logger } from '@/lib/logger';

let boss: PgBoss | null = null;

export const QUEUE_NAMES = {
  USFM_EXPORT: 'usfm-export',
} as const;

export interface USFMExportJob {
  projectUnitId: number;
  bookIds?: number[];
  requestedBy?: string;
}

export async function initializeQueue(): Promise<PgBoss> {
  if (boss) {
    return boss;
  }

  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for queue initialization');
  }

  boss = new PgBoss({
    connectionString,
    schema: 'pgboss',
    max: 10,
    application_name: 'scribe-server-queue',
    superviseIntervalSeconds: 60,        // How often to check queues
    maintenanceIntervalSeconds: 86400,   // Daily maintenance (1 day in seconds)
    monitorIntervalSeconds: 60,          // How often to monitor each queue
  });

  boss.on('error', (error: Error) => {
    console.error('============ PgBoss ERROR ============');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Name:', error.name);
    console.error('Code:', (error as any).code);
    console.error('Cause:', error.cause);
    console.error('Full Error:', error);
    console.error('======================================');
    
    logger.error('PgBoss errors:', { 
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: (error as any).code,
      cause: error.cause,
    });
  });

  await boss.start();
  logger.info('PgBoss queue initialized successfully');

  return boss;
}

export async function getQueue(): Promise<PgBoss> {
  if (!boss) {
    throw new Error('Queue not initialized. Call initializeQueue() first.');
  }
  return boss;
}

export async function stopQueue(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
    logger.info('PgBoss queue stopped');
  }
}