import type { z } from '@hono/zod-openapi';

import { count, eq, not, or } from 'drizzle-orm';

import type { insertUsersSchema, patchUsersSchema, selectUsersSchema } from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import { users } from '@/db/schema';

import {
  createUserWithInvitation as createUserWithInvitationService,
  sendInvitationToExistingUser as sendInvitationToExistingUserService,
} from './users.service';

export type User = z.infer<typeof selectUsersSchema>;
export type CreateUserInput = z.infer<typeof insertUsersSchema>;
export type UpdateUserInput = z.infer<typeof patchUsersSchema>;

export async function getAllUsers(): Promise<Result<User[]>> {
  const userList = await db.select().from(users);

  return userList
    ? { ok: true, data: userList }
    : { ok: false, error: { message: 'No Users found - or internal error' } };
}

export async function getUserById(id: number): Promise<Result<User>> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return user ? { ok: true, data: user } : { ok: false, error: { message: 'User not found' } };
}

export async function getUserByEmail(email: string): Promise<Result<User>> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return user ? { ok: true, data: user } : { ok: false, error: { message: 'User not found' } };
}

export async function getUserByUsername(username: string): Promise<Result<User>> {
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

  return user ? { ok: true, data: user } : { ok: false, error: { message: 'User not found' } };
}

export async function getUserByEmailOrUsername(identifier: string): Promise<Result<User>> {
  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.username, identifier)))
    .limit(1);

  return user ? { ok: true, data: user } : { ok: false, error: { message: 'User not found' } };
}

export async function createUser(input: CreateUserInput): Promise<Result<User>> {
  const [user] = await db.insert(users).values(input).returning();

  return user
    ? { ok: true, data: user }
    : { ok: false, error: { message: 'Unable to create user' } };
}

export async function createUserWithInvitation(input: CreateUserInput) {
  return await createUserWithInvitationService(input);
}

export async function sendInvitationEmailToExistingUser(
  userId: string,
  email: string,
  firstName?: string,
  lastName?: string
) {
  return await sendInvitationToExistingUserService(userId, email, firstName, lastName);
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<Result<User>> {
  const [updated] = await db.update(users).set(input).where(eq(users.id, id)).returning();

  return updated
    ? { ok: true, data: updated }
    : { ok: false, error: { message: 'Cannot update user' } };
}

export async function deleteUser(id: number): Promise<Result<boolean>> {
  const result = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });

  return result.length > 0
    ? { ok: true, data: true }
    : { ok: false, error: { message: 'Cannot delete user' } };
}

export async function toggleUserStatus(id: number): Promise<Result<User>> {
  const [updatedUser] = await db
    .update(users)
    .set({ isActive: not(users.isActive) })
    .where(eq(users.id, id))
    .returning();

  return updatedUser
    ? { ok: true, data: updatedUser }
    : { ok: false, error: { message: 'Cannot toggle user status' } };
}

export async function getUsersCount(): Promise<number> {
  const result = await db.select({ count: count() }).from(users);

  return result.length;
}

export async function getActiveUsers(): Promise<User[]> {
  return await db.select().from(users).where(eq(users.isActive, true));
}

export async function getInactiveUsers(): Promise<User[]> {
  return await db.select().from(users).where(eq(users.isActive, false));
}

export async function activateUser(id: number): Promise<Result<User>> {
  return await updateUser(id, { isActive: true });
}

export async function deactivateUser(id: number): Promise<Result<User>> {
  return await updateUser(id, { isActive: false });
}
