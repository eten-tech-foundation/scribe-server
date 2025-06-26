import { createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { insertTasksSchema, patchTasksSchema, selectTasksSchema } from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';
import { logger } from '@/lib/logger';
import * as taskHandler from '@/handlers/task.handler';
import { server } from '@/server/server';

const listTasksRoute = createRoute({
  tags: ['Tasks'],
  method: 'get',
  path: '/tasks',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectTasksSchema.array().openapi('Tasks'),
      'The list of tasks'
    ),
  },
  summary: 'Get all tasks',
  description: 'Returns a list of all tasks',
});

server.openapi(listTasksRoute, async (c) => {
  logger.info('Getting all tasks');
  const tasks = await taskHandler.getAllTasks();
  return c.json(tasks);
});

const createTaskRoute = createRoute({
  tags: ['Tasks'],
  method: 'post',
  path: '/tasks',
  request: {
    body: jsonContent(insertTasksSchema, 'The task to create'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTasksSchema, 'The created task'),
  },
  summary: 'Create a new task',
  description: 'Creates a new task with the provided data',
});

server.openapi(createTaskRoute, async (c) => {
  const task = await c.req.json();
  logger.info('Creating task', { task });
  const created = await taskHandler.createTask(task);
  return c.json(created, HttpStatusCodes.OK);
});

const getTaskRoute = createRoute({
  tags: ['Tasks'],
  method: 'get',
  path: '/tasks/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 5,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTasksSchema, 'The task'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Task not found'
    ),
  },
  summary: 'Get a task by ID',
  description: 'Returns a single task by its ID',
});

server.openapi(getTaskRoute, async (c) => {
  const { id } = c.req.param();
  logger.info(`Getting task ${id}`);
  const task = await taskHandler.getTaskById(Number(id));

  if (!task) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.json(task, HttpStatusCodes.OK);
});

const updateTaskRoute = createRoute({
  tags: ['Tasks'],
  method: 'patch',
  path: '/tasks/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 5,
      }),
    }),
    body: jsonContent(patchTasksSchema, 'The task updates'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTasksSchema, 'The updated task'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Task not found'
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
  summary: 'Update a task',
  description: 'Updates a task with the provided data',
});

server.openapi(updateTaskRoute, async (c) => {
  const { id } = c.req.param();
  const updates = await c.req.json();

  logger.info(`Updating task ${id}`, { updates });

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

  const task = await taskHandler.updateTask(Number(id), updates);

  if (!task) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.json(task, HttpStatusCodes.OK);
});

const deleteTaskRoute = createRoute({
  tags: ['Tasks'],
  method: 'delete',
  path: '/tasks/{id}',
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: 'id',
          in: 'path',
          required: true,
          allowReserved: false,
        },
        example: 5,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Task deleted',
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Task not found'
    ),
  },
  summary: 'Delete a task',
  description: 'Deletes a task by its ID',
});

server.openapi(deleteTaskRoute, async (c) => {
  const { id } = c.req.param();
  logger.info(`Deleting task ${id}`);

  const success = await taskHandler.deleteTask(Number(id));

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

export default server;
