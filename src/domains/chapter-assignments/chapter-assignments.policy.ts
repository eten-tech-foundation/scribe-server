/**
 * src/domains/chapter-assignments/chapter-assignment.policy.ts
 *
 * Record-level access rules for chapter assignments.
 * Now includes strict Organization-level multi-tenant isolation.
 */

import { ROLES } from '@/lib/roles';

interface PolicyUser {
  id: number;
  roleName: string;
  organization: number;
}

export interface PolicyChapterAssignment {
  organizationId: number;
  assignedUserId: number | null;
  peerCheckerId: number | null;
  status: string;
}

export const ChapterAssignmentPolicy = {
  /**
   * Can this user edit the content of this chapter assignment?
   */
  edit(user: PolicyUser, assignment: PolicyChapterAssignment, isProjectMember: boolean): boolean {
    if (user.organization !== assignment.organizationId) {
      return false;
    }

    if (user.roleName === ROLES.PROJECT_MANAGER) {
      return assignment.status === 'community_review';
    }

    // future roles can be prevented access using this
    if (user.roleName !== ROLES.TRANSLATOR) {
      return false;
    }

    switch (assignment.status) {
      case 'draft':
        return assignment.assignedUserId === user.id;

      case 'peer_check':
        return assignment.peerCheckerId === user.id;

      case 'community_review':
        return isProjectMember;

      default:
        return false;
    }
  },

  /**
   * Can this user manage (create / update / delete / bulk-assign) assignments?
   * Manager    : yes, ONLY if the assignment belongs to their organization.
   * Translator : never.
   */
  manage(user: PolicyUser, targetOrganizationId: number): boolean {
    return user.roleName === ROLES.PROJECT_MANAGER && user.organization === targetOrganizationId;
  },

  /**
   * Can this user submit (advance the status of) this assignment?
   */
  submit(user: PolicyUser, assignment: PolicyChapterAssignment, isProjectMember: boolean): boolean {
    // 1. Strict Organization Boundary Check
    if (user.organization !== assignment.organizationId) {
      return false;
    }

    if (user.roleName === ROLES.PROJECT_MANAGER) {
      return assignment.status === 'community_review';
    }

    if (user.roleName !== ROLES.TRANSLATOR) {
      return false;
    }

    if (assignment.status === 'draft') {
      return assignment.assignedUserId === user.id;
    }

    if (assignment.status === 'peer_check') {
      return assignment.peerCheckerId === user.id;
    }

    if (assignment.status === 'community_review') {
      return isProjectMember;
    }

    return false;
  },

  /**
   * Is this user a direct participant in this assignment?
   */
  isParticipant(user: PolicyUser, assignment: PolicyChapterAssignment): boolean {
    // 1. Strict Organization Boundary Check
    if (user.organization !== assignment.organizationId) {
      return false;
    }

    if (user.roleName !== ROLES.TRANSLATOR) {
      return false;
    }

    return assignment.assignedUserId === user.id || assignment.peerCheckerId === user.id;
  },
};
