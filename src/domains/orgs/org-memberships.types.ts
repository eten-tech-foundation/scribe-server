import { z } from '@hono/zod-openapi';

import type {
  insertOrgMembershipsSchema,
  patchOrgMembershipsSchema,
  selectOrgMembershipsSchema,
} from '@/db/schema';

// ─── DB-derived types ─────────────────────────────────────────────────────────

export type OrgMembership = z.infer<typeof selectOrgMembershipsSchema>;
export type CreateOrgMembershipInput = z.infer<typeof insertOrgMembershipsSchema>;
export type UpdateOrgMembershipInput = z.infer<typeof patchOrgMembershipsSchema>;

// ─── API response schema ──────────────────────────────────────────────────────

export const orgMembershipResponseSchema = z.object({
  userId: z.number().int(),
  orgId: z.number().int(),
  orgRole: z.enum(['org_owner', 'org_manager', 'member']),
  status: z.enum(['invited', 'verified', 'inactive']),
  createdBy: z.number().int().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export type OrgMembershipResponse = z.infer<typeof orgMembershipResponseSchema>;

export const createOrgMembershipRequestSchema = z.object({
  userId: z.number().int(),
  orgRole: z.enum(['org_owner', 'org_manager', 'member']).default('member'),
});

export const updateOrgMembershipRequestSchema = z.object({
  orgRole: z.enum(['org_owner', 'org_manager', 'member']),
});
