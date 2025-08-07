import type { z } from '@hono/zod-openapi';

import { count, eq, not, or } from 'drizzle-orm';

import type { insertUsersSchema, patchUsersSchema, selectUsersSchema } from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import { users } from '@/db/schema';
import management from '@/lib/auth0-management';
import { sendInvitationEmail } from '@/lib/mailgun';

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

export async function createUserWithInvitation(
  input: CreateUserInput
): Promise<Result<User & { auth0_user_id: string; ticket_url: string }>> {
  // 1. Check if user already exists
  const existingUserResult = await getUserByEmail(input.email);
  if (existingUserResult.ok) {
    return { ok: false, error: { message: 'A user with this email already exists.' } };
  }

  // 2. Create user in local database
  const dbResult = await createUser(input);
  if (!dbResult.ok) {
    return { ok: false, error: dbResult.error };
  }

  try {
    // 3. Create user in Auth0 without password (for invitation flow)
    const auth0User = await management.users.create({
      email: input.email,
      name:
        input.firstName && input.lastName
          ? `${input.firstName} ${input.lastName}`.trim()
          : input.firstName || input.lastName || input.email,
      connection: 'Username-Password-Authentication',
      email_verified: false,
      password: 'Scribepaw@4488',
      verify_email: false, // We'll handle verification through the password change ticket
      // Don't set a password - let them set it through the invitation
    });

    if (!auth0User.data.user_id) {
      throw new Error('Auth0 user creation did not return a user_id.');
    }

    // 4. Create password change ticket (invitation link)
    const ticket = await management.tickets.changePassword({
      user_id: auth0User.data.user_id,
      result_url: process.env.FRONTEND_URL || 'http://localhost:5173',
      mark_email_as_verified: true,
      ttl_sec: 604800, // 7 days
      includeEmailInRedirect: false,
    });

    if (!ticket.data.ticket) {
      throw new Error('Failed to generate password change ticket.');
    }

    // 5. Send invitation email via Mailgun
    const emailResult = await sendInvitationEmail({
      email: input.email,
      ticketUrl: ticket.data.ticket,
      firstName: input.firstName ?? undefined,
      lastName: input.lastName ?? undefined,
    });

    if (!emailResult.success) {
      // console.error('Failed to send invitation email:', emailResult.error);
    } else {
      // console.log(`Invitation email sent successfully to: ${input.email}`);
    }
    return {
      ok: true,
      data: {
        ...dbResult.data,
        auth0_user_id: auth0User.data.user_id,
        ticket_url: ticket.data.ticket,
      },
    };
  } catch (auth0Error) {
    await deleteUser(dbResult.data.id);

    const errorMessage = auth0Error instanceof Error ? auth0Error.message : 'Unknown Auth0 error';

    return {
      ok: false,
      error: {
        message: `User creation failed during Auth0 sync and was rolled back. Reason: ${errorMessage}`,
      },
    };
  }
}

// Send invitation email for existing user
export async function sendInvitationEmailToExistingUser(
  userId: string,
  email: string,
  firstName?: string,
  lastName?: string
): Promise<Result<{ ticket_url: string }>> {
  try {
    const ticket = await management.tickets.changePassword({
      user_id: userId,
      result_url: process.env.FRONTEND_URL,
      mark_email_as_verified: true,
      includeEmailInRedirect: true,
      ttl_sec: 604800,
    });

    const emailResult = await sendInvitationEmail({
      email,
      ticketUrl: ticket.data.ticket,
      firstName,
      lastName,
    });

    if (!emailResult.success) {
      throw new Error(`Failed to send email: ${emailResult.error}`);
    }

    return {
      ok: true,
      data: {
        ticket_url: ticket.data.ticket,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to send invitation',
      },
    };
  }
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
