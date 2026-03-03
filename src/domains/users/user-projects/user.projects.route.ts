import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { chapterStatusEnum, selectProjectsSchema } from '@/db/schema';
import { server } from '@/server/server';

import * as userProjectsHandler from './user.projects.handlers';

const chapterStatusCountsSchema = z.object(
  chapterStatusEnum.enumValues.reduce(
    (acc, status) => {
      acc[status] = z.number().int().min(0);
      return acc;
    },
    {} as Record<string, z.ZodNumber>
  )
);

const workflowStepSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const projectWithLanguageNamesSchema = selectProjectsSchema
  .omit({ sourceLanguage: true, targetLanguage: true })
  .extend({
    sourceLanguageName: z.string(),
    targetLanguageName: z.string(),
    sourceName: z.string().optional(),
    lastChapterActivity: z.union([z.date(), z.string()]).nullable(),
    createdAt: z.union([z.date(), z.string()]).nullable(),
    updatedAt: z.union([z.date(), z.string()]).nullable(),
    chapterStatusCounts: chapterStatusCountsSchema,
    workflowConfig: z.array(workflowStepSchema),
  });

const getUserProjectsRoute = createRoute({
  tags: ['Projects'],
  method: 'get',
  path: '/users/{userId}/projects',
  request: {
    params: z.object({
      userId: z.coerce.number().openapi({
        param: {
          name: 'userId',
          in: 'path',
          required: true,
        },
        example: 1,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      projectWithLanguageNamesSchema.array().openapi('UserProjects'),
      'The list of projects the user is a member of'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get projects for a user',
  description: 'Returns all projects the specified user is a member of',
});


server.openapi(getUserProjectsRoute, async (c) => {
  const { userId } = c.req.valid('param');

  const result = await userProjectsHandler.getProjectsByUserId(userId);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});