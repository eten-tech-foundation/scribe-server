import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { inject, injectable, postConstruct } from "inversify";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

import { insertTasksSchema, patchTasksSchema, selectTasksSchema } from "@/db/schema";
import { Delete, Get, Patch, Post, registerRoutes } from "@/decorators";
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from "@/lib/constants";
import { LoggerService } from "@/services/logger.service";
import { TaskService } from "@/services/task.service";

@injectable()
export class TaskController {
  constructor(
    @inject(TaskService) private readonly taskService: TaskService,
    @inject(LoggerService) private readonly logger: LoggerService,
  ) {}

  public setup(): void {
    registerRoutes(this);
  }

  @Get({
    path: "/tasks",
    tags: ["Tasks"],
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        selectTasksSchema.array().openapi("Tasks"),
        "The list of tasks",
      ),
    },
  })
  async list(ctx: Context): Promise<Response> {
    this.logger.info("Getting all tasks");
    const tasks = await this.taskService.getAllTasks();
    return ctx.json(tasks);
  }

  @Post({
    path: "/tasks",
    tags: ["Tasks"],
    request: {
      body: jsonContent(insertTasksSchema, "The task to create"),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(selectTasksSchema, "The created task"),
    },
  })
  async create(ctx: Context): Promise<Response> {
    const task = await ctx.req.json();
    this.logger.info("Creating task", { task });
    const created = await this.taskService.createTask(task);
    return ctx.json(created, HttpStatusCodes.OK);
  }

  @Get({
    path: "/tasks/{id}",
    tags: ["Tasks"],
    request: {
      params: z.object({
        id: z.coerce.number(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(selectTasksSchema, "The task"),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
        "Task not found",
      ),
    },
  })
  async getOne(ctx: Context): Promise<Response> {
    const { id } = ctx.req.param();
    this.logger.info(`Getting task ${id}`);
    const task = await this.taskService.getTaskById(Number(id));

    if (!task) {
      return ctx.json(
        {
          message: HttpStatusPhrases.NOT_FOUND,
        },
        HttpStatusCodes.NOT_FOUND,
      );
    }

    return ctx.json(task, HttpStatusCodes.OK);
  }

  @Patch({
    path: "/tasks/{id}",
    tags: ["Tasks"],
    request: {
      params: z.object({
        id: z.coerce.number(),
      }),
      body: jsonContent(patchTasksSchema, "The task updates"),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(selectTasksSchema, "The updated task"),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
        "Task not found",
      ),
      [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
        z.object({
          success: z.boolean(),
          error: z.object({
            issues: z.array(z.object({
              code: z.string(),
              path: z.array(z.string()),
              message: z.string(),
            })),
            name: z.string(),
          }),
        }),
        "The validation error",
      ),
    },
  })
  async patch(ctx: Context): Promise<Response> {
    const { id } = ctx.req.param();
    const updates = await ctx.req.json();

    this.logger.info(`Updating task ${id}`, { updates });

    if (Object.keys(updates).length === 0) {
      return ctx.json(
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
            name: "ZodError",
          },
        },
        HttpStatusCodes.UNPROCESSABLE_ENTITY,
      );
    }

    const task = await this.taskService.updateTask(Number(id), updates);

    if (!task) {
      return ctx.json(
        {
          message: HttpStatusPhrases.NOT_FOUND,
        },
        HttpStatusCodes.NOT_FOUND,
      );
    }

    return ctx.json(task, HttpStatusCodes.OK);
  }

  @Delete({
    path: "/tasks/{id}",
    tags: ["Tasks"],
    request: {
      params: z.object({
        id: z.coerce.number(),
      }),
    },
    responses: {
      [HttpStatusCodes.NO_CONTENT]: {
        description: "Task deleted",
      },
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
        "Task not found",
      ),
    },
  })
  async remove(ctx: Context): Promise<Response> {
    const { id } = ctx.req.param();
    this.logger.info(`Deleting task ${id}`);

    const success = await this.taskService.deleteTask(Number(id));

    if (!success) {
      return ctx.json(
        {
          message: HttpStatusPhrases.NOT_FOUND,
        },
        HttpStatusCodes.NOT_FOUND,
      );
    }

    return ctx.body(null, HttpStatusCodes.NO_CONTENT);
  }
}
