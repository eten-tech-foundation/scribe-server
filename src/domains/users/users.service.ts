import { randomBytes } from 'node:crypto';

import type { Result } from '@/lib/types';

import management from '@/lib/auth0-management';
import { sendInvitationEmail } from '@/lib/mailgun';

import type { CreateUserInput, User } from './users.handlers';

import { createUser, deleteUser, getUserByEmail } from './users.handlers';

export interface UserInvitationResult {
  user: User;
  auth0_user_id: string;
  ticket_url: string;
}

export async function createUserWithInvitation(
  input: CreateUserInput
): Promise<Result<UserInvitationResult>> {
  const normalizedInput = { ...input, email: input.email.toLowerCase() };
  // 1. Check if user already exists
  const existingUserResult = await getUserByEmail(normalizedInput.email);
  if (existingUserResult.ok) {
    return { ok: false, error: { message: 'A user with this email already exists.' } };
  }

  // 2. Create user in local database
  const dbResult = await createUser(normalizedInput);
  if (!dbResult.ok) {
    return { ok: false, error: dbResult.error };
  }

  try {
    // 3. Create user in Auth0
    const auth0User = await createAuth0User(normalizedInput);

    // 4. Create password change ticket (invitation link)
    const ticketUrl = await createPasswordChangeTicket(auth0User.user_id!);

    // 5. Send invitation email
    await sendUserInvitationEmail(normalizedInput, ticketUrl);

    return {
      ok: true,
      data: {
        user: dbResult.data,
        auth0_user_id: auth0User.user_id!,
        ticket_url: ticketUrl,
      },
    };
  } catch (error) {
    // Rollback: Delete user from database if Auth0 operations fail
    await deleteUser(dbResult.data.id);

    const errorMessage = error instanceof Error ? error.message : 'Unknown Auth0 error';
    return {
      ok: false,
      error: {
        message: `User creation failed during Auth0 sync and was rolled back. Reason: ${errorMessage}`,
      },
    };
  }
}

export async function sendInvitationToExistingUser(
  userId: string,
  email: string,
  firstName?: string,
  lastName?: string
): Promise<Result<{ ticket_url: string }>> {
  try {
    const lowercaseEmail = email.toLowerCase();
    const ticketUrl = await createPasswordChangeTicket(userId);

    await sendUserInvitationEmail(
      { email: lowercaseEmail, firstName: firstName ?? null, lastName: lastName ?? null },
      ticketUrl
    );

    return {
      ok: true,
      data: { ticket_url: ticketUrl },
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

async function createAuth0User(input: CreateUserInput) {
  const auth0User = await management.users.create({
    email: input.email,
    name: buildUserDisplayName(input),
    connection: 'Username-Password-Authentication',
    email_verified: false,
    password: generateTemporaryPassword(),
    verify_email: false,
  });

  if (!auth0User.data.user_id) {
    throw new Error('Auth0 user creation did not return a user_id.');
  }

  return auth0User.data;
}

async function createPasswordChangeTicket(userId: string): Promise<string> {
  const ticket = await management.tickets.changePassword({
    user_id: userId,
    result_url: process.env.FRONTEND_URL || 'http://localhost:5173',
    mark_email_as_verified: true,
    ttl_sec: 604800, // 7 days
    includeEmailInRedirect: false,
  });

  if (!ticket.data.ticket) {
    throw new Error('Failed to generate password change ticket.');
  }

  return ticket.data.ticket;
}

async function sendUserInvitationEmail(
  input: Pick<CreateUserInput, 'email' | 'firstName' | 'lastName'>,
  ticketUrl: string
): Promise<void> {
  const emailResult = await sendInvitationEmail({
    email: input.email,
    ticketUrl,
    firstName: input.firstName ?? undefined,
    lastName: input.lastName ?? undefined,
  });

  if (!emailResult.success) {
    console.error('Failed to send invitation email:', emailResult.error);
  }
}

function buildUserDisplayName(input: CreateUserInput): string {
  if (input.firstName && input.lastName) {
    return `${input.firstName} ${input.lastName}`.trim();
  }
  return input.firstName || input.lastName || input.email;
}

function generateTemporaryPassword(): string {
  return randomBytes(16).toString('base64').slice(0, 16);
}
