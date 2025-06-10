import type { z } from "@hono/zod-openapi";

import { eq } from "drizzle-orm";
import { inject, injectable } from "inversify";

import type { insertTasksSchema, patchTasksSchema, selectTasksSchema } from "@/db/schema";

import { tasks } from "@/db/schema";

import { DatabaseService } from "./database.service";
import { LoggerService } from "./logger.service";

export type Task = z.infer<typeof selectTasksSchema>;
export type CreateTaskInput = z.infer<typeof insertTasksSchema>;
export type UpdateTaskInput = z.infer<typeof patchTasksSchema>;

@injectable()
export class TaskService {
  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService,
    @inject(LoggerService) private logger: LoggerService,
  ) {}

  async getAllTasks(): Promise<Task[]> {
    this.logger.debug("Fetching all tasks");
    return await this.databaseService.db.select().from(tasks);
  }

  async getTaskById(id: number): Promise<Task | null> {
    this.logger.debug(`Fetching task with id: ${id}`);
    const result = await this.databaseService.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);
    return result[0] || null;
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    this.logger.debug("Creating new task", input);
    const [inserted] = await this.databaseService.db
      .insert(tasks)
      .values(input)
      .returning();
    return inserted;
  }

  async updateTask(id: number, input: UpdateTaskInput): Promise<Task | null> {
    this.logger.debug(`Updating task with id: ${id}`, input);

    // Check if task exists
    const existingTask = await this.getTaskById(id);
    if (!existingTask) {
      this.logger.warn(`Task with id ${id} not found for update`);
      return null;
    }

    // Update the task
    const [updated] = await this.databaseService.db
      .update(tasks)
      .set(input)
      .where(eq(tasks.id, id))
      .returning();
    return updated || null;
  }

  async deleteTask(id: number): Promise<boolean> {
    this.logger.debug(`Deleting task with id: ${id}`);

    // Check if task exists
    const existingTask = await this.getTaskById(id);
    if (!existingTask) {
      this.logger.warn(`Task with id ${id} not found for deletion`);
      return false;
    }

    const result = await this.databaseService.db
      .delete(tasks)
      .where(eq(tasks.id, id));
    return result.count > 0;
  }
}
