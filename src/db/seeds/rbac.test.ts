import { describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@/lib/permissions';
import { ORG_ROLES, PROJECT_ROLES } from '@/lib/roles';

describe('rBAC constants coverage', () => {
  it('org roles are defined', () => {
    expect(ORG_ROLES.ORG_OWNER).toBe('org_owner');
    expect(ORG_ROLES.ORG_MANAGER).toBe('org_manager');
    expect(ORG_ROLES.MEMBER).toBe('member');
  });

  it('project roles are defined', () => {
    expect(PROJECT_ROLES.PROJECT_MANAGER).toBe('project_manager');
    expect(PROJECT_ROLES.TRANSLATOR).toBe('translator');
    expect(PROJECT_ROLES.PEER_CHECKER).toBe('peer_checker');
    expect(PROJECT_ROLES.OBSERVER).toBe('observer');
  });

  it('org membership permissions are defined', () => {
    expect(PERMISSIONS.ORG_MEMBER_VIEW).toBe('org_member:view');
    expect(PERMISSIONS.ORG_MEMBER_INVITE).toBe('org_member:invite');
    expect(PERMISSIONS.ORG_MEMBER_UPDATE).toBe('org_member:update');
    expect(PERMISSIONS.ORG_MEMBER_REMOVE).toBe('org_member:remove');
  });
});
