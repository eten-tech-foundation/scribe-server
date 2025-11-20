import { DBOS } from '@dbos-inc/dbos-sdk';

import env from '@/env';
import { logger } from '@/lib/logger';

export async function initializeDBOS() {
  try {
    DBOS.setConfig({
      name: 'fluent-usfm-export',
      systemDatabaseUrl: env.DBOS_DATABASE_URL,
    });

    await DBOS.launch();

    logger.info('✅ DBOS initialized');

    return DBOS;
  } catch (error) {
    logger.error('❌ Failed to initialize DBOS', { error });
    throw error;
  }
}

export { DBOS };
