import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { insertUsersSchema, patchUsersSchema, selectUsersSchema } from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';
import { server } from '@/server/server';

import * as userHandler from './users.handlers';

const listUsersRoute = createRoute({
  tags: ['Users'],
  method: 'get',
  path: '/users',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectUsersSchema.array().openapi('Users'),
      'The list of users'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get all users',
  description: 'Returns a list of all users',
});

server.openapi(listUsersRoute, async (c) => {
  const result = await userHandler.getAllUsers();

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
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

  const result = await userHandler.createUser(userData);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.CREATED);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
});

const createUserWithInvitationRoute = createRoute({
  tags: ['Users'],
  method: 'post',
  path: '/users/invite',
  request: {
    body: jsonContent(insertUsersSchema, 'The user to create and invite'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectUsersSchema.extend({
        auth0_user_id: z.string().optional(),
        invitation_sent: z.boolean().optional(),
      }),
      'User created and invitation sent'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Validation error, duplicate user, or Auth0 error'
    ),
  },
  summary: 'Create user and send Auth0 invitation',
  description: 'Creates a new user in database and sends Auth0 invitation email',
});

server.openapi(createUserWithInvitationRoute, async (c) => {
  const userData = await c.req.json();

  const result = await userHandler.createUserWithInvitation(userData);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.CREATED);
  }

  return c.json(
    {
      message: result.error.message,
    },
    HttpStatusCodes.BAD_REQUEST
  );
});

const getUserRoute = createRoute({
  tags: ['Users'],
  method: 'get',
  path: '/users/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 1,
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
  const { id } = c.req.valid('param');

  const result = await userHandler.getUserById(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
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

  const result = await userHandler.getUserByEmail(email);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
});

const updateUserRoute = createRoute({
  tags: ['Users'],
  method: 'patch',
  path: '/users/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 1,
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
  const { id } = c.req.valid('param');
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

  const result = await userHandler.updateUser(id, updates);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
});

const deleteUserRoute = createRoute({
  tags: ['Users'],
  method: 'delete',
  path: '/users/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 1,
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
  const { id } = c.req.valid('param');

  const result = await userHandler.deleteUser(id);

  if (result.ok) {
    return c.body(null, HttpStatusCodes.NO_CONTENT);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
});

const toggleUserStatusRoute = createRoute({
  tags: ['Users'],
  method: 'patch',
  path: '/users/{id}/toggle-status',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 1,
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
  const { id } = c.req.valid('param');

  const result = await userHandler.toggleUserStatus(id);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
});
