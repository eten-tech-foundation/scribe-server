import type { z } from '@hono/zod-openapi';
import { eq, or } from 'drizzle-orm';

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

export async function getUserByEmail(email: string): Promise<User | null> {
  logger.debug(`Fetching user with email: ${email}`);
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] || null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  logger.debug(`Fetching user with username: ${username}`);
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0] || null;
}

export async function getUserByEmailOrUsername(identifier: string): Promise<User | null> {
  logger.debug(`Fetching user with email or username: ${identifier}`);
  const result = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.username, identifier)))
    .limit(1);
  return result[0] || null;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  logger.debug('Creating new user', { 
    username: input.username, 
    email: input.email 
  });
  
  const [inserted] = await db.insert(users).values(input).returning();
  
  logger.info('User created successfully', { 
    id: inserted.id, 
    username: inserted.username, 
    email: inserted.email 
  });
  
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
  
  if (updated) {
    logger.info('User updated successfully', { 
      id: updated.id, 
      username: updated.username, 
      email: updated.email 
    });
  }
  
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
  
  if (result.count > 0) {
    logger.info('User deleted successfully', { 
      id: existingUser.id, 
      username: existingUser.username, 
      email: existingUser.email 
    });
  }
  
  return result.count > 0;
}

export async function toggleUserStatus(id: string): Promise<User | null> {
  logger.debug(`Toggling user status for id: ${id}`);

  // Check if user exists
  const existingUser = await getUserById(id);
  if (!existingUser) {
    logger.warn(`User with id ${id} not found for status toggle`);
    return null;
  }

  const newStatus = !existingUser.isActive;
  const [updated] = await db
    .update(users)
    .set({ isActive: newStatus })
    .where(eq(users.id, id))
    .returning();
  
  if (updated) {
    logger.info('User status toggled successfully', { 
      id: updated.id, 
      username: updated.username, 
      email: updated.email,
      isActive: updated.isActive 
    });
  }
  
  return updated || null;
}

// Additional helper functions for common use cases

export async function getUsersCount(): Promise<number> {
  logger.debug('Getting users count');
  const result = await db.select({ count: users.id }).from(users);
  return result.length;
}

export async function getActiveUsers(): Promise<User[]> {
  logger.debug('Fetching active users');
  return await db.select().from(users).where(eq(users.isActive, true));
}

export async function getInactiveUsers(): Promise<User[]> {
  logger.debug('Fetching inactive users');
  return await db.select().from(users).where(eq(users.isActive, false));
}

export async function activateUser(id: string): Promise<User | null> {
  logger.debug(`Activating user with id: ${id}`);

  // Check if user exists
  const existingUser = await getUserById(id);
  if (!existingUser) {
    logger.warn(`User with id ${id} not found for activation`);
    return null;
  }

  if (existingUser.isActive) {
    logger.info(`User with id ${id} is already active`);
    return existingUser;
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: true })
    .where(eq(users.id, id))
    .returning();
  
  if (updated) {
    logger.info('User activated successfully', { 
      id: updated.id, 
      username: updated.username, 
      email: updated.email 
    });
  }
  
  return updated || null;
}

export async function deactivateUser(id: string): Promise<User | null> {
  logger.debug(`Deactivating user with id: ${id}`);

  // Check if user exists
  const existingUser = await getUserById(id);
  if (!existingUser) {
    logger.warn(`User with id ${id} not found for deactivation`);
    return null;
  }

  if (!existingUser.isActive) {
    logger.info(`User with id ${id} is already inactive`);
    return existingUser;
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: false })
    .where(eq(users.id, id))
    .returning();
  
  if (updated) {
    logger.info('User deactivated successfully', { 
      id: updated.id, 
      username: updated.username, 
      email: updated.email 
    });
  }
  
  return updated || null;
}