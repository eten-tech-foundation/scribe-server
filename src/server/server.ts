import { OpenAPIHono } from '@hono/zod-openapi';
import { injectable } from 'inversify';
import { cors } from 'hono/cors';

import type { AppBindings } from '@/lib/types';

@injectable()
export class Server {
  private _hono = new OpenAPIHono<AppBindings>({
    strict: false,
  });

  constructor() {
    this._hono.use('*', cors());
  }

  get hono() {
    return this._hono;
  }
}
