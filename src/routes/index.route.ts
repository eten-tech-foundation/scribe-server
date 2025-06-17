import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { IocContainer } from '@/ioc/container';
import { Server } from '@/server/server';

// Setup index route directly with IoC
const server = IocContainer.container.get(Server);

const indexRoute = createRoute({
  tags: ['Index'],
  method: 'get',
  path: '/',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(createMessageObjectSchema('Tasks API'), 'Tasks API Index'),
  },
});

server.hono.openapi(indexRoute, (c) => {
  return c.json(
    {
      message: 'Tasks API',
    },
    HttpStatusCodes.OK
  );
});

export default server.hono;
