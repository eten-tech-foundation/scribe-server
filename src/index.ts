import 'dotenv/config';
import { serve } from '@hono/node-server';

import env from '@/env';
import { initializeDBOS } from '@/lib/dbos.config';
import { logger } from '@/lib/logger';

import app from './app';

async function main() {
  try {
    // Initialize DBOS
    await initializeDBOS();

    // Start server
    serve(
      {
        fetch: app.fetch,
        port: env.PORT,
      },
      (info) => {
        logger.info(`🚀 Server running on http://localhost:${info.port}`);
      }
    );
  } catch (error) {
    logger.error('Failed to start', { error });
    process.exit(1);
  }
}

main();