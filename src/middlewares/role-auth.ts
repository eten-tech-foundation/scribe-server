import type { Context, Next } from 'hono';

import { HTTPException } from 'hono/http-exception';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { Permission } from '@/lib/permissions';
import type { AppBindings } from '@/lib/types';

import { getOrgMember } from '@/domains/orgs/org-memberships.service';
import { getUserByEmail } from '@/domains/users/users.service';
import { roleHasPermissionByName } from '@/lib/services/permissions/permissions.service';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailMatch(sourceEmail: string, targetEmail: string): boolean {
  return normalizeEmail(sourceEmail) === normalizeEmail(targetEmail);
}

/**
 * 1. Authentication Middleware
 * Validates the token, fetches the user by email, and stores identity in context.
 * Does NOT load org membership — that is done by requireOrgAccess().
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

  c.set('user', userResult.data);
  await next();
}

/**
 * 2. Org-scoped Middleware
 * Loads the user's membership in the org identified by the orgIdParam path param.
 * Rejects inactive members. Stores membership as `orgMembership` in context.
 */
export function requireOrgAccess(orgIdParam = 'orgId') {
  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, { message: 'User not authenticated' });
    }

    const rawOrgId = c.req.param(orgIdParam);
    const orgId = Number(rawOrgId);
    if (!orgId || Number.isNaN(orgId)) {
      throw new HTTPException(HttpStatusCodes.BAD_REQUEST, {
        message: 'Missing or invalid orgId',
      });
    }

    const membershipResult = await getOrgMember(user.id, orgId);
    if (!membershipResult.ok) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
        message: 'Not a member of this organization',
      });
    }

    const membership = membershipResult.data;
    if (membership.status === 'inactive') {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
        message: 'Org membership is inactive',
      });
    }

    (c as any).set('orgMembership', membership);
    await next();
  };
}

/**
 * 3. Authorization Middleware
 * Checks if the user's org role or project roles have the given permission.
 * Requires authenticateUser to have run first.
 * Uses orgMembership (if set by requireOrgAccess) and projectAuthContext (if set by project middleware).
 */
export function requirePermission(permission: Permission) {
  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, { message: 'User not authenticated' });
    }

    const orgMembership = (c as any).get('orgMembership');
    const projectAuthContext = (c as any).get('projectAuthContext');

    const roleNames: string[] = [];
    if (orgMembership) roleNames.push(orgMembership.orgRole);
    if (projectAuthContext?.projectRoles) roleNames.push(...projectAuthContext.projectRoles);

    if (roleNames.length === 0) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, { message: 'No role context available' });
    }

    const grants = await Promise.all(
      roleNames.map((roleName) => roleHasPermissionByName(roleName, permission))
    );

    if (!grants.some(Boolean)) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, { message: 'Insufficient permissions' });
    }

    await next();
  };
}

/**
 * 4. Self-Access Middleware
 * Ensures the authenticated user can only access their own resources.
 */
export function requireSelf() {
  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, { message: 'User not authenticated' });
    }

    const { userId } = c.req.param();
    if (!userId || user.id !== Number(userId)) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
        message: 'You can only access your own resources',
      });
    }

    await next();
  };
}
