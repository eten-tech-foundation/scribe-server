import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { getHttpStatus } from '@/lib/types';
import { server } from '@/server/server';

import * as translateService from './ai-translate.service';
import {
  jobStatusResponseSchema,
  translateRequestSchema,
  translateResponseSchema,
} from './ai-translate.types';

// ---------------------------------------------------------------------------
// POST /ai-translate
// ---------------------------------------------------------------------------

const submitTranslateRoute = createRoute({
  tags: ['AI Translate'],
  method: 'post',
  path: '/ai-translate',
  request: {
    body: jsonContent(translateRequestSchema, 'Translation request details'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      translateResponseSchema,
      'Translation job submitted successfully'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Invalid request body'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Submit text for AI translation',
  description:
    'Submits a batch of verses to the Vachan AI translation API. Automatically resolves ' +
    'language names to BCP-47 codes. Returns a job ID to poll for results.',
});

server.openapi(submitTranslateRoute, async (c) => {
  const req = c.req.valid('json');
  const result = await translateService.submitTranslationJob(req);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
});

// ---------------------------------------------------------------------------
// GET /ai-translate/job/{jobId}
// ---------------------------------------------------------------------------

const getJobStatusRoute = createRoute({
  tags: ['AI Translate'],
  method: 'get',
  path: '/ai-translate/job/{jobId}',
  request: {
    params: z.object({
      jobId: z.coerce.number().openapi({
        param: { name: 'jobId', in: 'path', required: true },
        example: 410866,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(jobStatusResponseSchema, 'Translation job status and output'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Job not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get AI translation job status',
  description: 'Polls the Vachan API for the status and output of a translation job.',
});

server.openapi(getJobStatusRoute, async (c) => {
  const { jobId } = c.req.valid('param');
  const result = await translateService.getJobStatus(jobId);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
});

export default server;
