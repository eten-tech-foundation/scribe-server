import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { PERMISSIONS } from '@/lib/permissions';
import { getHttpStatus } from '@/lib/types';
import { authenticateUser, requirePermission } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as orgMembershipsService from './org-memberships.service';
import {
  createOrgMembershipRequestSchema,
  orgMembershipResponseSchema,
  updateOrgMembershipRequestSchema,
} from './org-memberships.types';

const orgIdParam = z.object({
  orgId: z.coerce.number().openapi({ param: { name: 'orgId', in: 'path', required: true } }),
});

const orgUserParam = orgIdParam.extend({
  userId: z.coerce.number().openapi({ param: { name: 'userId', in: 'path', required: true } }),
});

// GET /organizations/:orgId/members
server.openapi(
  createRoute({
    tags: ['Org Members'],
    method: 'get',
    path: '/organizations/{orgId}/members',
    middleware: [authenticateUser, requirePermission(PERMISSIONS.ORG_MEMBER_VIEW)] as const,
    request: { params: orgIdParam },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(orgMembershipResponseSchema.array(), 'Org members'),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        createMessageObjectSchema('Unauthorized'),
        'Unauthorized'
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        createMessageObjectSchema('Forbidden'),
        'Forbidden'
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
        'Internal server error'
      ),
    },
  }),
  async (c) => {
    const { orgId } = c.req.valid('param');
    const result = await orgMembershipsService.getOrgMembers(orgId);
    if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
    return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
  }
);

// POST /organizations/:orgId/members
server.openapi(
  createRoute({
    tags: ['Org Members'],
    method: 'post',
    path: '/organizations/{orgId}/members',
    middleware: [authenticateUser, requirePermission(PERMISSIONS.ORG_MEMBER_INVITE)] as const,
    request: {
      params: orgIdParam,
      body: jsonContentRequired(createOrgMembershipRequestSchema, 'Membership to create'),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(orgMembershipResponseSchema, 'Created membership'),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        createMessageObjectSchema('Unauthorized'),
        'Unauthorized'
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        createMessageObjectSchema('Forbidden'),
        'Forbidden'
      ),
      [HttpStatusCodes.CONFLICT]: jsonContent(
        createMessageObjectSchema('Conflict'),
        'Already a member'
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
        'Internal server error'
      ),
    },
  }),
  async (c) => {
    const { orgId } = c.req.valid('param');
    const body = c.req.valid('json');
    const currentUser = c.get('user')!;

    const result = await orgMembershipsService.addOrgMember({
      orgId,
      userId: body.userId,
      orgRole: body.orgRole ?? 'member',
      status: 'invited',
      createdBy: currentUser.id,
    });

    if (result.ok) return c.json(result.data, HttpStatusCodes.CREATED);
    return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
  }
);

// PATCH /organizations/:orgId/members/:userId
server.openapi(
  createRoute({
    tags: ['Org Members'],
    method: 'patch',
    path: '/organizations/{orgId}/members/{userId}',
    middleware: [authenticateUser, requirePermission(PERMISSIONS.ORG_MEMBER_UPDATE)] as const,
    request: {
      params: orgUserParam,
      body: jsonContentRequired(updateOrgMembershipRequestSchema, 'Role update'),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(orgMembershipResponseSchema, 'Updated membership'),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        createMessageObjectSchema('Not Found'),
        'Member not found'
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        createMessageObjectSchema('Unauthorized'),
        'Unauthorized'
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        createMessageObjectSchema('Forbidden'),
        'Forbidden'
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
        'Internal server error'
      ),
    },
  }),
  async (c) => {
    const { orgId, userId } = c.req.valid('param');
    const { orgRole } = c.req.valid('json');
    const result = await orgMembershipsService.updateOrgMemberRole(userId, orgId, orgRole);
    if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
    return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
  }
);

// DELETE /organizations/:orgId/members/:userId
server.openapi(
  createRoute({
    tags: ['Org Members'],
    method: 'delete',
    path: '/organizations/{orgId}/members/{userId}',
    middleware: [authenticateUser, requirePermission(PERMISSIONS.ORG_MEMBER_REMOVE)] as const,
    request: { params: orgUserParam },
    responses: {
      [HttpStatusCodes.NO_CONTENT]: { description: 'Member removed' },
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        createMessageObjectSchema('Not Found'),
        'Member not found'
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        createMessageObjectSchema('Unauthorized'),
        'Unauthorized'
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        createMessageObjectSchema('Forbidden'),
        'Forbidden'
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
        'Internal server error'
      ),
    },
  }),
  async (c) => {
    const { orgId, userId } = c.req.valid('param');
    const result = await orgMembershipsService.removeOrgMember(userId, orgId);
    if (result.ok) return c.body(null, HttpStatusCodes.NO_CONTENT);
    return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
  }
);
