import { createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { insertUsersSchema, patchUsersSchema, selectUsersSchema } from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';
import { logger } from '@/lib/logger';
import * as userHandler from './user.handler';
import { server } from '@/server/server';

const listUsersRoute = createRoute({
  tags: ['Users'],
  method: 'get',
  path: '/users',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectUsersSchema.array().openapi('Users'),
      'The list of users'
    ),
  },
  summary: 'Get all users',
  description: 'Returns a list of all users',
});

server.openapi(listUsersRoute, async (c) => {
  logger.info('Getting all users');
  const users = await userHandler.getAllUsers();
  return c.json(users);
});

const createUserRoute = createRoute({
  tags: ['Users'],
  method: 'post',
  path: '/users',
  request: {
    body: jsonContent(insertUsersSchema, 'The user to create'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectUsersSchema, 'The created user'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.object({
        success: z.boolean(),
        error: z.object({
          issues: z.array(
            z.object({
              code: z.string(),
              path: z.array(z.string()),
              message: z.string(),
            })
          ),
          name: z.string(),
        }),
      }),
      'The validation error'
    ),
  },
  summary: 'Create a new user',
  description: 'Creates a new user with the provided data',
});

server.openapi(createUserRoute, async (c) => {
  const user = await c.req.json();
  logger.info('Creating user', { user });
  const created = await userHandler.createUser(user);
  return c.json(created, HttpStatusCodes.OK);
});

const getUserRoute = createRoute({
  tags: ['Users'],
  method: 'get',
  path: '/users/{id}',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectUsersSchema, 'The user'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'User not found'
    ),
  },
  summary: 'Get a user by ID',
  description: 'Returns a single user by its ID',
});

server.openapi(getUserRoute, async (c) => {
  const { id } = c.req.param();
  logger.info(`Getting user ${id}`);
  const user = await userHandler.getUserById(id);

  if (!user) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.json(user, HttpStatusCodes.OK);
});

const updateUserRoute = createRoute({
  tags: ['Users'],
  method: 'patch',
  path: '/users/{id}',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      }),
    }),
    body: jsonContent(patchUsersSchema, 'The user updates'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectUsersSchema, 'The updated user'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'User not found'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.object({
        success: z.boolean(),
        error: z.object({
          issues: z.array(
            z.object({
              code: z.string(),
              path: z.array(z.string()),
              message: z.string(),
            })
          ),
          name: z.string(),
        }),
      }),
      'The validation error'
    ),
  },
  summary: 'Update a user',
  description: 'Updates a user with the provided data',
});

server.openapi(updateUserRoute, async (c) => {
  const { id } = c.req.param();
  const updates = await c.req.json();

  logger.info(`Updating user ${id}`, { updates });

  if (Object.keys(updates).length === 0) {
    return c.json(
      {
        success: false,
        error: {
          issues: [
            {
              code: ZOD_ERROR_CODES.INVALID_UPDATES,
              path: [],
              message: ZOD_ERROR_MESSAGES.NO_UPDATES,
            },
          ],
          name: 'ZodError',
        },
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }

  const user = await userHandler.updateUser(id, updates);

  if (!user) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.json(user, HttpStatusCodes.OK);
});

const deleteUserRoute = createRoute({
  tags: ['Users'],
  method: 'delete',
  path: '/users/{id}',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'User deleted successfully',
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'User not found'
    ),
  },
  summary: 'Delete a user',
  description: 'Deletes a user by its ID',
});

server.openapi(deleteUserRoute, async (c) => {
  const { id } = c.req.param();
  logger.info(`Deleting user ${id}`);
  const deleted = await userHandler.deleteUser(id);

  if (!deleted) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT);
}); 