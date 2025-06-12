import { OpenAPIHono } from '@hono/zod-openapi';
import { injectable, inject } from 'inversify';
import { cors } from 'hono/cors';

import type { AppBindings } from '@/lib/types';
import { LoggerService } from '@/services/logger.service';

@injectable()
export class Server {
  private _hono = new OpenAPIHono<AppBindings>({
    strict: false,
  });

  constructor(@inject(LoggerService) private readonly loggerService: LoggerService) {
    this._hono.use('*', cors());

    this._hono.use('*', async (c, next) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;

      this.loggerService.info(`${c.req.method} ${c.req.path} - ${c.res.status} - ${duration}ms`);
    });

    this._hono.use('*', async (c, next) => {
      await next();

      if (c.req.method === 'GET' && !c.res.headers.get('Cache-Control')) {
        c.res.headers.set('Cache-Control', 'max-age=60');
      }
    });
  }

  get hono() {
    return this._hono;
  }
}
