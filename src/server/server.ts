import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';

import type { AppBindings } from '@/lib/types';

import { logger } from '@/lib/logger';

export function createServer() {
  const app = new OpenAPIHono<AppBindings>({
    strict: false,
  });

  app.use('*', cors());

  app.use('*', async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    logger.info(`${c.req.method} ${c.req.path} - ${c.res.status} - ${duration}ms`);
  });

  app.use('*', async (c, next) => {
    await next();

    if (c.req.method === 'GET' && !c.res.headers.get('Cache-Control')) {
      c.res.headers.set('Cache-Control', 'max-age=60');
    }
  });

  return app;
}

export const server = createServer();
