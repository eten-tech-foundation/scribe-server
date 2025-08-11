import type { Context, MiddlewareHandler } from 'hono';

import { HTTPException } from 'hono/http-exception';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppBindings } from '@/lib/types';

import { getUserByEmail, getUserById } from '@/domains/users/users.handlers';

export const ROLES = {
  MANAGER: 1,
  TRANSLATOR: 2,
} as const;

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
  if (!user.isActive) {
    throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
      message: 'User account is inactive',
    });
  }

  return user;
}

async function ensureSameOrganization(managerOrg: number, targetUserId?: string) {
  if (!targetUserId) return;
  const targetUserResult = await getUserById(Number.parseInt(targetUserId));
  if (!targetUserResult.ok || managerOrg !== targetUserResult.data.organization) {
    throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
      message: 'Cannot access users from different organization',
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
      (targetUserEmail && user.email !== targetUserEmail)
    ) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
        message: 'You can only access your own profile',
      });
    }
  }

  c.set('user', user);
  await next();
};
