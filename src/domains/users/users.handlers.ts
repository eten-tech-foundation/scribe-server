import type { z } from '@hono/zod-openapi';
import { eq, or } from 'drizzle-orm';

import type { insertUsersSchema, patchUsersSchema, selectUsersSchema } from '@/db/schema';
import { users } from '@/db/schema';
import { db } from '@/db';

export type User = z.infer<typeof selectUsersSchema>;
export type CreateUserInput = z.infer<typeof insertUsersSchema>;
export type UpdateUserInput = z.infer<typeof patchUsersSchema>;

export type Result<T, E = { message: string }> = 
  | { ok: true; data: T }
  | { ok: false; error: E };

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

export async function updateUser(id: string, input: UpdateUserInput): Promise<Result<User>> {
  const [updated] = await db.update(users).set(input).where(eq(users.id, id)).returning();

  return updated 
    ? { ok: true, data: updated } 
    : { ok: false, error: { message: 'User not found' } };
}

export async function deleteUser(id: string): Promise<Result<boolean>> {
  const result = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });

  return result.length > 0
    ? { ok: true, data: true }
    : { ok: false, error: { message: 'User not found' } };
}

export async function toggleUserStatus(id: string): Promise<Result<User>> {
  // First get the current user to determine the new status
  const existingUser = await getUserById(id);
  if (!existingUser) {
    return { ok: false, error: { message: 'User not found' } };
  }

  const newStatus = !existingUser.isActive;
  const [updated] = await db
    .update(users)
    .set({ isActive: newStatus })
    .where(eq(users.id, id))
    .returning();

  return updated 
    ? { ok: true, data: updated }
    : { ok: false, error: { message: 'User not found' } };
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

export async function activateUser(id: string): Promise<Result<User>> {
  return await updateUser(id, { isActive: true });
}

export async function deactivateUser(id: string): Promise<Result<User>> {
  return await updateUser(id, { isActive: false });
}
