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
  assignedUserId?: number | null;
  peerCheckerId?: number | null;
  status?: string | null;
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
      return (
        assignment.status === 'community_review' ||
        assignment.status === 'linguist_check' ||
        assignment.status === 'theological_check' ||
        assignment.status === 'consultant_check'
      );
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
      case 'linguist_check':
      case 'theological_check':
      case 'consultant_check':
        return isProjectMember;

      default:
        return false;
    }
  },

  /**
   * Can this user view a list of all chapter assignments in this org?
   */
  viewAll(user: PolicyUser, targetOrganizationId: number): boolean {
    return user.organization === targetOrganizationId;
  },

  /**
   * Can this user view this specific chapter assignment?
   */
  view(user: PolicyUser, assignment: PolicyChapterAssignment): boolean {
    return user.organization === assignment.organizationId;
  },

  /**
   * Can this user create a chapter assignment?
   */
  create(user: PolicyUser, targetOrganizationId: number): boolean {
    return user.roleName === ROLES.PROJECT_MANAGER && user.organization === targetOrganizationId;
  },

  /**
   * Can this user update this chapter assignment (e.g., metadata, non-content)?
   */
  update(user: PolicyUser, assignment: PolicyChapterAssignment): boolean {
    return (
      user.roleName === ROLES.PROJECT_MANAGER && user.organization === assignment.organizationId
    );
  },

  /**
   * Can this user delete this chapter assignment?
   */
  delete(user: PolicyUser, assignment: PolicyChapterAssignment): boolean {
    return (
      user.roleName === ROLES.PROJECT_MANAGER && user.organization === assignment.organizationId
    );
  },

  /**
   * Can this user delete all chapter assignments for a project/org?
   */
  deleteAll(user: PolicyUser, targetOrganizationId: number): boolean {
    return user.roleName === ROLES.PROJECT_MANAGER && user.organization === targetOrganizationId;
  },

  /**
   * Can this user assign all chapter assignments for a project/org?
   */
  assignAll(user: PolicyUser, targetOrganizationId: number): boolean {
    return user.roleName === ROLES.PROJECT_MANAGER && user.organization === targetOrganizationId;
  },

  /**
   * Base assignment logic (Internal abstraction)
   */
  _assign(user: PolicyUser, assignment: PolicyChapterAssignment): boolean {
    return (
      user.roleName === ROLES.PROJECT_MANAGER && user.organization === assignment.organizationId
    );
  },

  /**
   * Can this user assign a drafter to this assignment?
   */
  assignDrafter(user: PolicyUser, assignment: PolicyChapterAssignment): boolean {
    return this._assign(user, assignment);
  },

  /**
   * Can this user assign a peer checker to this assignment?
   */
  assignPeerChecker(user: PolicyUser, assignment: PolicyChapterAssignment): boolean {
    return this._assign(user, assignment);
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
      return (
        assignment.status === 'community_review' ||
        assignment.status === 'linguist_check' ||
        assignment.status === 'theological_check' ||
        assignment.status === 'consultant_check'
      );
    }

    if (user.roleName !== ROLES.TRANSLATOR) {
      return false;
    }

    // Refactored to use switch statement for expressive intent and consistency
    switch (assignment.status) {
      case 'draft':
        return assignment.assignedUserId === user.id;

      case 'peer_check':
        return assignment.peerCheckerId === user.id;

      case 'community_review':
      case 'linguist_check':
      case 'theological_check':
      case 'consultant_check':
        return isProjectMember;

      default:
        return false;
    }
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
