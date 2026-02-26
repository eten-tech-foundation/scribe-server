import type { Context, Next } from 'hono';

import { HTTPException } from 'hono/http-exception';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { Permission } from '@/lib/permissions';
import type { AppBindings } from '@/lib/types';

import { roleHasPermission } from '@/domains/permissions/permissions.service';
import { getUserByEmail } from '@/domains/users/users.handlers';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailMatch(sourceEmail: string, targetEmail: string): boolean {
  return normalizeEmail(sourceEmail) === normalizeEmail(targetEmail);
}

/**
 * 1. Authentication Middleware
 * Validates the token, fetches the user, checks status, and stores in context.
 */
export async function authenticateUser(c: Context<AppBindings>, next: Next) {
  const userEmail = c.get('loggedInUserEmail');
  if (!userEmail) {
    throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
      message: 'User email not found in token',
    });
  }

  const userResult = await getUserByEmail(userEmail);

  if (!userResult.ok) {
    throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
      message: 'User not found in database',
    });
  }

  const user = userResult.data;

  if (user.status === 'inactive') {
    throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
      message: 'User account is inactive',
    });
  }

  // Store user in context for downstream middlewares/handlers
  c.set('user', user);
  await next();
}

/**
 * 2. Authorization Middleware
 * Relies on authenticateUser running first. Checks if the user's role has the permission.
 */
export function requirePermission(permission: Permission) {
  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
        message: 'User not authenticated',
      });
    }

    const granted = await roleHasPermission(user.role, permission);

    if (!granted) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
        message: 'Insufficient permissions',
      });
    }

    await next();
  };
}
