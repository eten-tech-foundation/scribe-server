import { and, eq } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { org_memberships } from '@/db/schema';
import { handleConstraintError } from '@/lib/db-errors';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type { CreateOrgMembershipInput, OrgMembership } from './org-memberships.types';

export async function findByOrg(orgId: number): Promise<Result<OrgMembership[]>> {
  try {
    const rows = await db.select().from(org_memberships).where(eq(org_memberships.orgId, orgId));
    return ok(rows);
  } catch (error) {
    logger.error({ cause: error, message: 'Failed to find org members', context: { orgId } });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function findByUserAndOrg(
  userId: number,
  orgId: number
): Promise<Result<OrgMembership>> {
  try {
    const [row] = await db
      .select()
      .from(org_memberships)
      .where(and(eq(org_memberships.userId, userId), eq(org_memberships.orgId, orgId)))
      .limit(1);
    if (!row) return err(ErrorCode.ORG_MEMBER_NOT_FOUND);
    return ok(row);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to find org member',
      context: { userId, orgId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function findAllByUser(userId: number): Promise<Result<OrgMembership[]>> {
  try {
    const rows = await db.select().from(org_memberships).where(eq(org_memberships.userId, userId));
    return ok(rows);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to find org memberships for user',
      context: { userId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function insert(input: CreateOrgMembershipInput): Promise<Result<OrgMembership>> {
  try {
    const [row] = await db.insert(org_memberships).values(input).returning();
    if (!row) return err(ErrorCode.INTERNAL_ERROR);
    return ok(row);
  } catch (error) {
    return handleConstraintError(error);
  }
}

export async function update(
  userId: number,
  orgId: number,
  patch: Partial<Pick<OrgMembership, 'orgRole' | 'status'>>
): Promise<Result<OrgMembership>> {
  try {
    const [updated] = await db
      .update(org_memberships)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(org_memberships.userId, userId), eq(org_memberships.orgId, orgId)))
      .returning();
    if (!updated) return err(ErrorCode.ORG_MEMBER_NOT_FOUND);
    return ok(updated);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to update org member',
      context: { userId, orgId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function remove(userId: number, orgId: number): Promise<Result<void>> {
  try {
    const [deleted] = await db
      .delete(org_memberships)
      .where(and(eq(org_memberships.userId, userId), eq(org_memberships.orgId, orgId)))
      .returning({ userId: org_memberships.userId });
    if (!deleted) return err(ErrorCode.ORG_MEMBER_NOT_FOUND);
    return ok(undefined);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to remove org member',
      context: { userId, orgId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
