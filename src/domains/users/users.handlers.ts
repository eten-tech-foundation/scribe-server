import type { z } from '@hono/zod-openapi';
import { eq, or } from 'drizzle-orm';

import type { insertUsersSchema, patchUsersSchema, selectUsersSchema } from '@/db/schema';
import { users } from '@/db/schema';
import { db } from '@/db';

export type User = z.infer<typeof selectUsersSchema>;
export type CreateUserInput = z.infer<typeof insertUsersSchema>;
export type UpdateUserInput = z.infer<typeof patchUsersSchema>;

export async function getAllUsers(): Promise<User[]> {
  return await db.select().from(users);
}

export async function getUserById(id: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] || null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0] || null;
}

export async function getUserByEmailOrUsername(identifier: string): Promise<User | null> {
  const result = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.username, identifier)))
    .limit(1);
  return result[0] || null;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const [inserted] = await db.insert(users).values(input).returning();
  return inserted;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User | null> {
  const existingUser = await getUserById(id);
  if (!existingUser) {
    return null;
  }

  const [updated] = await db.update(users).set(input).where(eq(users.id, id)).returning();

  return updated || null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const existingUser = await getUserById(id);
  if (!existingUser) {
    return false;
  }

  const result = await db.delete(users).where(eq(users.id, id));

  return result.count > 0;
}

export async function toggleUserStatus(id: string): Promise<User | null> {
  const existingUser = await getUserById(id);
  if (!existingUser) {
    return null;
  }

  const newStatus = !existingUser.isActive;
  const [updated] = await db
    .update(users)
    .set({ isActive: newStatus })
    .where(eq(users.id, id))
    .returning();

  return updated || null;
}

export async function getUsersCount(): Promise<number> {
  const result = await db.select({ count: users.id }).from(users);
  return result.length;
}

export async function getActiveUsers(): Promise<User[]> {
  return await db.select().from(users).where(eq(users.isActive, true));
}

export async function getInactiveUsers(): Promise<User[]> {
  return await db.select().from(users).where(eq(users.isActive, false));
}

export async function activateUser(id: string): Promise<User | null> {
  const existingUser = await getUserById(id);
  if (!existingUser) {
    return null;
  }

  if (existingUser.isActive) {
    return existingUser;
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: true })
    .where(eq(users.id, id))
    .returning();

  return updated || null;
}

export async function deactivateUser(id: string): Promise<User | null> {
  const existingUser = await getUserById(id);
  if (!existingUser) {
    return null;
  }

  if (!existingUser.isActive) {
    return existingUser;
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: false })
    .where(eq(users.id, id))
    .returning();

  return updated || null;
}
