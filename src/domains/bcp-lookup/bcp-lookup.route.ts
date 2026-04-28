import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { getHttpStatus } from '@/lib/types';
import { server } from '@/server/server';

import * as bcpService from './bcp-lookup.service';
import { bcpLookupQuerySchema, bcpLookupResponseSchema } from './bcp-lookup.types';

// ---------------------------------------------------------------------------
// GET /bcp-lookup
// ---------------------------------------------------------------------------

const bcpLookupRoute = createRoute({
  tags: ['BCP Lookup'],
  method: 'get',
  path: '/bcp-lookup',
  request: {
    query: bcpLookupQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      bcpLookupResponseSchema.array().openapi('BcpLookupResults'),
      'Matching BCP-47 code entries'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'At least one of `language` or `iso` query params is required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Look up BCP-47 code',
  description:
    'Given a language name (partial, case-insensitive) **or** an ISO 639-3 / ISO 639-1 code, ' +
    'returns matching rows including the BCP-47 code. ' +
    'Provide either `language` or `iso` as a query parameter.',
});

server.openapi(bcpLookupRoute, async (c) => {
  const query = c.req.valid('query');
  const result = await bcpService.lookupBcp(query);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
});

export default server;
