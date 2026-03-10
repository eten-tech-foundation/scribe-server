/**
 * src/domains/projects/project.policy.ts
 *
 * Record-level access rules for projects.
 *
 * Called AFTER requirePermission() has confirmed the role has the permission.
 * These functions answer: can THIS user act on THIS specific project?
 */

import { ROLES } from '@/lib/roles';

import type { ProjectWithLanguageNames } from './projects.handlers';

interface PolicyUser {
  id: number;
  role: number;
  roleName: string;
  organization: number;
}

export const ProjectPolicy = {
  /**
   * Can this user list all projects in the standard org route?
   *
   * Project Manager : yes.
   * Translator      : no (they will use a separate /users/me/projects endpoint).
   */
  list(user: PolicyUser): boolean {
    return user.roleName === ROLES.PROJECT_MANAGER;
  },

  /**
   * Can this user view this specific project?
   *
   * Project Manager : yes, if the project belongs to their organisation.
   * Translator      : yes, if they are assigned to at least one chapter in it.
   *
   * `isAssignedToProject` is resolved inline in the route handler by checking
   * the project_users table. Defaults to false.
   */
  read(user: PolicyUser, project: ProjectWithLanguageNames, isAssignedToProject = false): boolean {
    if (user.roleName === ROLES.PROJECT_MANAGER) {
      return project.organization === user.organization;
    }

    if (user.roleName === ROLES.TRANSLATOR) {
      return isAssignedToProject;
    }

    return false;
  },

  /**
   * Can this user update this project?
   *
   * Project Manager : yes, if the project belongs to their organisation.
   * Translator      : never.
   */
  update(user: PolicyUser, project: ProjectWithLanguageNames): boolean {
    if (user.roleName === ROLES.PROJECT_MANAGER) {
      return project.organization === user.organization;
    }

    return false;
  },

  /**
   * Can this user delete this project?
   *
   * Project Manager : yes, if the project belongs to their organisation.
   * Translator      : never.
   */
  delete(user: PolicyUser, project: ProjectWithLanguageNames): boolean {
    if (user.roleName === ROLES.PROJECT_MANAGER) {
      return project.organization === user.organization;
    }

    return false;
  },
};
