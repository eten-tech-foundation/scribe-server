import type { Context, MiddlewareHandler } from 'hono';

import { HTTPException } from 'hono/http-exception';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppBindings } from '@/lib/types';

import { getUserByEmail, getUserById } from '@/domains/users/users.handlers';

export const ROLES = {
  MANAGER: 1,
  TRANSLATOR: 2,
} as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailMatch(sourceEmail: string, targetEmail: string): boolean {
  const sourceEmailNormalized = normalizeEmail(sourceEmail);
  const targetEmailNormalized = normalizeEmail(targetEmail);

  return sourceEmailNormalized === targetEmailNormalized;
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

async function ensureSameOrganization(managerOrg: number, targetUserId?: string) {
  if (!targetUserId) return;
  const targetUserResult = await getUserById(Number.parseInt(targetUserId, 10));
  // 404 for both "user not found" and "user in different org"
  if (!targetUserResult.ok || managerOrg !== targetUserResult.data.organization) {
    throw new HTTPException(HttpStatusCodes.NOT_FOUND, {
      message: 'User not found',
    });
  }
}

export const requireManagerAccess: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = await getAuthenticatedUser(c);
  if (user.role !== ROLES.MANAGER) {
    throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
      message: 'Insufficient permissions for this action',
    });
  }
  c.set('user', user);
  await next();
};

export const requireManagerUserAccess: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = await getAuthenticatedUser(c);
  if (user.role !== ROLES.MANAGER) {
    throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
      message: 'Access denied',
    });
  }
  await ensureSameOrganization(user.organization, c.req.param('id'));
  c.set('user', user);
  await next();
};

export const requireUserAccess: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = await getAuthenticatedUser(c);
  const targetUserId = c.req.param('id');
  const targetUserEmail = c.req.param('email');

  if (user.role === ROLES.MANAGER) {
    await ensureSameOrganization(user.organization, targetUserId);
  } else if (user.role === ROLES.TRANSLATOR) {
    if (
      (targetUserId && user.id !== Number.parseInt(targetUserId)) ||
      (targetUserEmail && !emailMatch(user.email, targetUserEmail))
    ) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
        message: 'You can only access your own profile',
      });
    }
  }

  c.set('user', user);
  await next();
};
