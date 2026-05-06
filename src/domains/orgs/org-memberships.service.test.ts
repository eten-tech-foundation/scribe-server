import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorMessages } from '@/lib/types';

import * as repo from './org-memberships.repository';
import {
  addOrgMember,
  getOrgMember,
  getOrgMembers,
  getUserMemberships,
  removeOrgMember,
  updateOrgMemberRole,
  verifyMembership,
} from './org-memberships.service';

vi.mock('./org-memberships.repository', () => ({
  findByOrg: vi.fn(),
  findByUserAndOrg: vi.fn(),
  findAllByUser: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const mockMembership = {
  userId: 1,
  orgId: 10,
  orgRole: 'member' as const,
  status: 'verified' as const,
  createdBy: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

beforeEach(() => vi.clearAllMocks());

describe('getOrgMembers', () => {
  it('returns members for an org', async () => {
    vi.mocked(repo.findByOrg).mockResolvedValue({ ok: true, data: [mockMembership] });
    const result = await getOrgMembers(10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
    expect(repo.findByOrg).toHaveBeenCalledWith(10);
  });

  it('propagates repo error', async () => {
    vi.mocked(repo.findByOrg).mockResolvedValue({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: ErrorMessages.INTERNAL_ERROR },
    });
    const result = await getOrgMembers(10);
    expect(result.ok).toBe(false);
  });
});

describe('getOrgMember', () => {
  it('returns the membership for a specific user in an org', async () => {
    vi.mocked(repo.findByUserAndOrg).mockResolvedValue({ ok: true, data: mockMembership });
    const result = await getOrgMember(1, 10);
    expect(result.ok).toBe(true);
    expect(repo.findByUserAndOrg).toHaveBeenCalledWith(1, 10);
  });

  it('returns ORG_MEMBER_NOT_FOUND when missing', async () => {
    vi.mocked(repo.findByUserAndOrg).mockResolvedValue({
      ok: false,
      error: { code: 'ORG_MEMBER_NOT_FOUND', message: ErrorMessages.ORG_MEMBER_NOT_FOUND },
    });
    const result = await getOrgMember(1, 99);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ORG_MEMBER_NOT_FOUND');
  });
});

describe('getUserMemberships', () => {
  it('returns all org memberships for a user', async () => {
    vi.mocked(repo.findAllByUser).mockResolvedValue({ ok: true, data: [mockMembership] });
    const result = await getUserMemberships(1);
    expect(result.ok).toBe(true);
    expect(repo.findAllByUser).toHaveBeenCalledWith(1);
  });
});

describe('addOrgMember', () => {
  it('inserts and returns the new membership', async () => {
    vi.mocked(repo.insert).mockResolvedValue({ ok: true, data: mockMembership });
    const result = await addOrgMember({
      userId: 1,
      orgId: 10,
      orgRole: 'member',
      status: 'invited',
      createdBy: 2,
    });
    expect(result.ok).toBe(true);
    expect(repo.insert).toHaveBeenCalledWith({
      userId: 1,
      orgId: 10,
      orgRole: 'member',
      status: 'invited',
      createdBy: 2,
    });
  });
});

describe('updateOrgMemberRole', () => {
  it('updates the org role', async () => {
    const updated = { ...mockMembership, orgRole: 'org_manager' as const };
    vi.mocked(repo.update).mockResolvedValue({ ok: true, data: updated });
    const result = await updateOrgMemberRole(1, 10, 'org_manager');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.orgRole).toBe('org_manager');
    expect(repo.update).toHaveBeenCalledWith(1, 10, { orgRole: 'org_manager' });
  });
});

describe('removeOrgMember', () => {
  it('removes a membership', async () => {
    vi.mocked(repo.remove).mockResolvedValue({ ok: true, data: undefined });
    const result = await removeOrgMember(1, 10);
    expect(result.ok).toBe(true);
    expect(repo.remove).toHaveBeenCalledWith(1, 10);
  });
});

describe('verifyMembership', () => {
  it('sets status to verified', async () => {
    const verified = { ...mockMembership, status: 'verified' as const };
    vi.mocked(repo.update).mockResolvedValue({ ok: true, data: verified });
    const result = await verifyMembership(1, 10);
    expect(result.ok).toBe(true);
    expect(repo.update).toHaveBeenCalledWith(1, 10, { status: 'verified' });
  });
});
