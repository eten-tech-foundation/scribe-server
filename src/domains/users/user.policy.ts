import type { AppPolicyUser } from '@/lib/types';

import { ORG_ROLES } from '@/lib/roles';

interface PolicyTargetUser {
  id: number;
}

const _isOrgAdmin = (user: AppPolicyUser): boolean =>
  user.orgRole === ORG_ROLES.ORG_OWNER || user.orgRole === ORG_ROLES.ORG_MANAGER;

export const UserPolicy = {
  list(user: AppPolicyUser): boolean {
    return _isOrgAdmin(user);
  },

  view(user: AppPolicyUser, targetUser: PolicyTargetUser): boolean {
    if (_isOrgAdmin(user)) return true;
    return user.id === targetUser.id;
  },

  create(user: AppPolicyUser): boolean {
    return _isOrgAdmin(user);
  },

  update(user: AppPolicyUser, targetUser: PolicyTargetUser): boolean {
    if (_isOrgAdmin(user)) return true;
    return user.id === targetUser.id;
  },

  delete(user: AppPolicyUser, targetUser: PolicyTargetUser): boolean {
    return _isOrgAdmin(user);
  },
};
