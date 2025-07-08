import type { z } from '@hono/zod-openapi';

import { eq } from 'drizzle-orm';

import type { insertTasksSchema, patchTasksSchema, selectTasksSchema } from '@/db/schema';

import { tasks } from '@/db/schema';
import { db } from '@/db';
import { logger } from '@/lib/logger';

export type Task = z.infer<typeof selectTasksSchema>;
export type CreateTaskInput = z.infer<typeof insertTasksSchema>;
export type UpdateTaskInput = z.infer<typeof patchTasksSchema>;

export async function getAllTasks(): Promise<Task[]> {
  logger.debug('Fetching all tasks');
  return await db.select().from(tasks);
}

export async function getTaskById(id: number): Promise<Task | null> {
  logger.debug(`Fetching task with id: ${id}`);
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0] || null;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  logger.debug('Creating new task', input);
  const [inserted] = await db.insert(tasks).values(input).returning();
  return inserted;
}

export async function updateTask(id: number, input: UpdateTaskInput): Promise<Task | null> {
  logger.debug(`Updating task with id: ${id}`, input);

  // Check if task exists
  const existingTask = await getTaskById(id);
  if (!existingTask) {
    logger.warn(`Task with id ${id} not found for update`);
    return null;
  }

  // Update the task
  const [updated] = await db.update(tasks).set(input).where(eq(tasks.id, id)).returning();
  return updated || null;
}

export async function deleteTask(id: number): Promise<boolean> {
  logger.debug(`Deleting task with id: ${id}`);

  // Check if task exists
  const existingTask = await getTaskById(id);
  if (!existingTask) {
    logger.warn(`Task with id ${id} not found for deletion`);
    return false;
  }

  const result = await db.delete(tasks).where(eq(tasks.id, id));
  return result.count > 0;
}
