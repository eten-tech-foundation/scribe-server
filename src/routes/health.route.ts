import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';
import { z } from 'zod';

import { IocContainer } from '@/ioc/container';
import { Server } from '@/server/server';

const server = IocContainer.container.get(Server);

const healthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string(),
  environment: z.string().optional(),
});

const healthRoute = createRoute({
  tags: ['Health'],
  method: 'get',
  path: '/health',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(healthResponseSchema, 'Health check response'),
  },
  summary: 'Health check endpoint',
  description: 'Returns the current health status of the API',
});

server.hono.openapi(healthRoute, (c) => {
  return c.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
    },
    HttpStatusCodes.OK
  );
});

export default server.hono;
