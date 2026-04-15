import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { server } from '@/server/server';

const indexRoute = createRoute({
  tags: ['Index'],
  method: 'get',
  path: '/',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(createMessageObjectSchema('Fluent API'), 'Fluent API Index'),
  },
});

server.openapi(indexRoute, (c) => {
  return c.json(
    {
      message: 'Fluent API',
    },
    HttpStatusCodes.OK
  );
});

export default server;
