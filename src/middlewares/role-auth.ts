import type { Context, MiddlewareHandler } from 'hono';

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

async function getAuthenticatedUser(c: Context<AppBindings>) {
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

  return user;
}

export function requirePermission(permission: Permission): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const user = await getAuthenticatedUser(c);

    const granted = await roleHasPermission(user.role, permission);

    if (!granted) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
        message: 'Insufficient permissions',
      });
    }

    c.set('user', user);
    await next();
  };
}
