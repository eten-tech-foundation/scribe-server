import type { AppPolicyUser } from '@/lib/types';

import { ORG_ROLES, PROJECT_ROLES } from '@/lib/roles';

import type { ProjectWithLanguageNames } from './projects.types';

const _isOrgAdmin = (user: AppPolicyUser): boolean =>
  user.orgRole === ORG_ROLES.ORG_OWNER || user.orgRole === ORG_ROLES.ORG_MANAGER;

const _isProjectManager = (user: AppPolicyUser): boolean =>
  user.projectRoles.includes(PROJECT_ROLES.PROJECT_MANAGER);

export const ProjectPolicy = {
  list(user: AppPolicyUser): boolean {
    return _isOrgAdmin(user);
  },

  read(user: AppPolicyUser, project: ProjectWithLanguageNames, isProjectMember = false): boolean {
    if (_isOrgAdmin(user)) return project.organization === user.orgId;
    return isProjectMember;
  },

  update(user: AppPolicyUser, project: ProjectWithLanguageNames): boolean {
    if (_isOrgAdmin(user)) return project.organization === user.orgId;
    return _isProjectManager(user);
  },

  delete(user: AppPolicyUser, project: ProjectWithLanguageNames): boolean {
    if (_isOrgAdmin(user)) return project.organization === user.orgId;
    return false;
  },
};
