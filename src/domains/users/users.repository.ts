import { count, eq, not, or } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { roles, users } from '@/db/schema';
import { handleUniqueConstraintError } from '@/lib/db-errors';
import { err, ErrorCode, ok } from '@/lib/types';

import type { CreateUserInput, UpdateUserInput, User } from './users.types';

export async function findAll(): Promise<Result<User[]>> {
  try {
    return ok(await db.select().from(users));
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function findByOrganization(organization: number): Promise<Result<User[]>> {
  try {
    return ok(await db.select().from(users).where(eq(users.organization, organization)));
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function findById(id: number): Promise<Result<User>> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) return err(ErrorCode.USER_NOT_FOUND);
    return ok(user);
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function findByEmail(email: string): Promise<Result<User & { roleName: string }>> {
  try {
    const [result] = await db
      .select({ user: users, roleName: roles.name })
      .from(users)
      .innerJoin(roles, eq(users.role, roles.id))
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!result) return err(ErrorCode.USER_NOT_FOUND);
    return ok({ ...result.user, roleName: result.roleName });
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function findByUsername(username: string): Promise<Result<User>> {
  try {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user) return err(ErrorCode.USER_NOT_FOUND);
    return ok(user);
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function findByEmailOrUsername(identifier: string): Promise<Result<User>> {
  try {
    const lower = identifier.toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, lower), eq(users.username, identifier)))
      .limit(1);
    if (!user) return err(ErrorCode.USER_NOT_FOUND);
    return ok(user);
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function insert(input: CreateUserInput): Promise<Result<User>> {
  try {
    const [user] = await db
      .insert(users)
      .values({ ...input, email: input.email.toLowerCase() })
      .returning();
    if (!user) return err(ErrorCode.INTERNAL_ERROR);
    return ok(user);
  } catch (error) {
    return handleUniqueConstraintError(error);
  }
}

export async function update(id: number, input: UpdateUserInput): Promise<Result<User>> {
  try {
    const updateInput = input.email ? { ...input, email: input.email.toLowerCase() } : input;
    const [updated] = await db.update(users).set(updateInput).where(eq(users.id, id)).returning();
    if (!updated) return err(ErrorCode.USER_NOT_FOUND);
    return ok(updated);
  } catch (error) {
    return handleUniqueConstraintError(error);
  }
}

export async function remove(id: number): Promise<Result<void>> {
  try {
    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (!deleted) return err(ErrorCode.USER_NOT_FOUND);
    return ok(undefined);
  } catch {
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function countAll(): Promise<number> {
  const [result] = await db.select({ count: count() }).from(users);
  return result?.count ?? 0;
}

export async function findActive(): Promise<User[]> {
  return db
    .select()
    .from(users)
    .where(not(eq(users.status, 'inactive')));
}

export async function findInactive(): Promise<User[]> {
  return db.select().from(users).where(eq(users.status, 'inactive'));
}
