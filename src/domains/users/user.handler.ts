import type { z } from '@hono/zod-openapi';

import { eq } from 'drizzle-orm';

import type { insertUsersSchema, patchUsersSchema, selectUsersSchema } from '@/db/schema';

import { users } from '@/db/schema';
import { db } from '@/db';
import { logger } from '@/lib/logger';

export type User = z.infer<typeof selectUsersSchema>;
export type CreateUserInput = z.infer<typeof insertUsersSchema>;
export type UpdateUserInput = z.infer<typeof patchUsersSchema>;

export async function getAllUsers(): Promise<User[]> {
  logger.debug('Fetching all users');
  return await db.select().from(users);
}

export async function getUserById(id: string): Promise<User | null> {
  logger.debug(`Fetching user with id: ${id}`);
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  logger.debug('Creating new user', input);
  const [inserted] = await db.insert(users).values(input).returning();
  return inserted;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User | null> {
  logger.debug(`Updating user with id: ${id}`, input);

  // Check if user exists
  const existingUser = await getUserById(id);
  if (!existingUser) {
    logger.warn(`User with id ${id} not found for update`);
    return null;
  }

  // Update the user
  const [updated] = await db.update(users).set(input).where(eq(users.id, id)).returning();
  return updated || null;
}

export async function deleteUser(id: string): Promise<boolean> {
  logger.debug(`Deleting user with id: ${id}`);

  // Check if user exists
  const existingUser = await getUserById(id);
  if (!existingUser) {
    logger.warn(`User with id ${id} not found for deletion`);
    return false;
  }

  const result = await db.delete(users).where(eq(users.id, id));
  return result.count > 0;
} 