import type { OrgRoleName } from '@/lib/roles';
import type { Result } from '@/lib/types';

import type { CreateOrgMembershipInput, OrgMembership } from './org-memberships.types';

import * as repo from './org-memberships.repository';

export function getOrgMembers(orgId: number): Promise<Result<OrgMembership[]>> {
  return repo.findByOrg(orgId);
}

export function getOrgMember(userId: number, orgId: number): Promise<Result<OrgMembership>> {
  return repo.findByUserAndOrg(userId, orgId);
}

export function getUserMemberships(userId: number): Promise<Result<OrgMembership[]>> {
  return repo.findAllByUser(userId);
}

export function addOrgMember(input: CreateOrgMembershipInput): Promise<Result<OrgMembership>> {
  return repo.insert(input);
}

export function updateOrgMemberRole(
  userId: number,
  orgId: number,
  orgRole: OrgRoleName
): Promise<Result<OrgMembership>> {
  return repo.update(userId, orgId, { orgRole });
}

export function removeOrgMember(userId: number, orgId: number): Promise<Result<void>> {
  return repo.remove(userId, orgId);
}

export function verifyMembership(userId: number, orgId: number): Promise<Result<OrgMembership>> {
  return repo.update(userId, orgId, { status: 'verified' });
}
