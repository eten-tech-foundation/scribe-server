import type { Context, MiddlewareHandler, Next } from 'hono';

import { HTTPException } from 'hono/http-exception';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppBindings } from '@/lib/types'; // Adjust path as needed

import { getUserByEmail, getUserById } from '@/domains/users/users.handlers';

export const ROLES = {
  MANAGER: 1,
  TRANSLATOR: 2,
} as const;

export const requireManagerAccess: MiddlewareHandler<AppBindings> = async (
  c: Context<AppBindings>,
  next: Next
): Promise<void> => {
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

  if (!userResult.data.isActive) {
    throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
      message: 'User account is inactive',
    });
  }

  if (userResult.data.role !== ROLES.MANAGER) {
    throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
      message: 'Insufficient permissions for this action',
    });
  }

  c.set('user', userResult.data);
  await next();
};

export const requireManagerUserAccess: MiddlewareHandler<AppBindings> = async (
  c: Context<AppBindings>,
  next: Next
): Promise<void> => {
  const userEmail = c.get('loggedInUserEmail');
  if (!userEmail) {
    throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
      message: 'User email not found in token',
    });
  }

  const userResult = await getUserByEmail(userEmail);

  if (!userResult.ok || !userResult.data.isActive || userResult.data.role !== ROLES.MANAGER) {
    throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
      message: 'Access denied',
    });
  }

  const targetUserId = c.req.param('id');
  if (targetUserId) {
    const targetUserResult = await getUserById(Number.parseInt(targetUserId));
    if (
      !targetUserResult.ok ||
      userResult.data.organization !== targetUserResult.data.organization
    ) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
        message: 'Cannot access users from different organization',
      });
    }
  }

  c.set('user', userResult.data);
  await next();
};

export const requireUserAccess: MiddlewareHandler<AppBindings> = async (
  c: Context<AppBindings>,
  next: Next
): Promise<void> => {
  const userEmail = c.get('loggedInUserEmail');
  if (!userEmail) {
    throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
      message: 'User email not found in token',
    });
  }

  const userResult = await getUserByEmail(userEmail);

  if (!userResult.ok || !userResult.data.isActive) {
    throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
      message: 'Access denied',
    });
  }

  const user = userResult.data;

  if (user.role === ROLES.MANAGER) {
    const targetUserId = c.req.param('id');
    if (targetUserId) {
      const targetUserResult = await getUserById(Number.parseInt(targetUserId));
      if (!targetUserResult.ok || user.organization !== targetUserResult.data.organization) {
        throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
          message: 'Cannot access users from different organization',
        });
      }
    }
  } else if (user.role === ROLES.TRANSLATOR) {
    const targetUserId = c.req.param('id');
    const targetUserEmail = c.req.param('email');

    if (
      (targetUserId && user.id !== Number.parseInt(targetUserId)) ||
      (targetUserEmail && user.email !== targetUserEmail)
    ) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
        message: 'You can only access your own profile',
      });
    }
  }

  c.set('user', userResult.data);
  await next();
};
