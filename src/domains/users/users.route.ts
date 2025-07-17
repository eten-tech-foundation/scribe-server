import { createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';
import { insertUsersSchema, patchUsersSchema, selectUsersSchema } from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';
import * as userHandler from './users.handlers';
import { server } from '@/server/server';
import { logger } from '@/lib/logger';

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
    [HttpStatusCodes.CREATED]: jsonContent(selectUsersSchema, 'The created user'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Validation error or duplicate user'
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
  summary: 'Create a new user',
  description: 'Creates a new user with the provided data',
});

server.openapi(createUserRoute, async (c) => {
  const userData = await c.req.json();

  try {
    const created = await userHandler.createUser(userData);
    return c.json(created, HttpStatusCodes.CREATED);
  } catch (error) {
    const code = (error as any)?.cause?.code;

    if (code === '23505') {
      return c.json({ message: 'Username or email already exists' }, HttpStatusCodes.BAD_REQUEST);
    }

    logger.error('Error creating user', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json(
      { message: error instanceof Error ? error.message : HttpStatusPhrases.INTERNAL_SERVER_ERROR },
      HttpStatusCodes.BAD_REQUEST
    );
  }
});

const getUserRoute = createRoute({
  tags: ['Users'],
  method: 'get',
  path: '/users/{id}',
  request: {
    params: z.object({
      id: z
        .string()
        .uuid('Invalid UUID format')
        .openapi({
          param: {
            name: 'id',
            in: 'path',
            required: true,
            allowReserved: false,
          },
          example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
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
  description: 'Returns a single user by their ID',
});

server.openapi(getUserRoute, async (c) => {
  const { id } = c.req.param();

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

const getUserByEmailRoute = createRoute({
  tags: ['Users'],
  method: 'get',
  path: '/users/email/{email}',
  request: {
    params: z.object({
      email: z
        .string()
        .email('Invalid email format')
        .openapi({
          param: {
            name: 'email',
            in: 'path',
            required: true,
            allowReserved: false,
          },
          example: 'user@example.com',
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
  summary: 'Get a user by email',
  description: 'Returns a single user by their email address',
});

server.openapi(getUserByEmailRoute, async (c) => {
  const { email } = c.req.param();

  const user = await userHandler.getUserByEmail(email);

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
      id: z
        .string()
        .uuid('Invalid UUID format')
        .openapi({
          param: {
            name: 'id',
            in: 'path',
            required: true,
            allowReserved: false,
          },
          example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
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
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Validation or constraint error'
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

  try {
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
  } catch (error) {
    const code = (error as any)?.cause?.code;

    if (code === '23505') {
      return c.json({ message: 'Username or email already exists' }, HttpStatusCodes.BAD_REQUEST);
    }

    logger.error('Error updating user', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json(
      { message: error instanceof Error ? error.message : HttpStatusPhrases.INTERNAL_SERVER_ERROR },
      HttpStatusCodes.BAD_REQUEST
    );
  }
});

const deleteUserRoute = createRoute({
  tags: ['Users'],
  method: 'delete',
  path: '/users/{id}',
  request: {
    params: z.object({
      id: z
        .string()
        .uuid('Invalid UUID format')
        .openapi({
          param: {
            name: 'id',
            in: 'path',
            required: true,
            allowReserved: false,
          },
          example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        }),
    }),
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'User deleted',
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'User not found'
    ),
  },
  summary: 'Delete a user',
  description: 'Deletes a user by their ID',
});

server.openapi(deleteUserRoute, async (c) => {
  const { id } = c.req.param();

  const success = await userHandler.deleteUser(id);

  if (!success) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT);
});

const toggleUserStatusRoute = createRoute({
  tags: ['Users'],
  method: 'patch',
  path: '/users/{id}/toggle-status',
  request: {
    params: z.object({
      id: z
        .string()
        .uuid('Invalid UUID format')
        .openapi({
          param: {
            name: 'id',
            in: 'path',
            required: true,
            allowReserved: false,
          },
          example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectUsersSchema, 'User status toggled'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'User not found'
    ),
  },
  summary: 'Toggle user status',
  description: 'Toggles the active status of a user',
});

server.openapi(toggleUserStatusRoute, async (c) => {
  const { id } = c.req.param();

  const user = await userHandler.toggleUserStatus(id);

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
