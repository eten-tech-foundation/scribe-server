/**
 * src/domains/chapter-assignments/chapter-assignment.policy.ts
 *
 * Record-level access rules for chapter assignments.
 * Now includes strict Organization-level multi-tenant isolation.
 */

import type { AppPolicyUser } from '@/lib/types';

import { ORG_ROLES, PROJECT_ROLES } from '@/lib/roles';

import { CHAPTER_ASSIGNMENT_STATUS } from './chapter-assignments.types';

export interface PolicyChapterAssignment {
  organizationId: number;
  assignedUserId?: number | null;
  peerCheckerId?: number | null;
  status?: string | null;
}

const _isProjectManager = (user: AppPolicyUser): boolean =>
  user.orgRole === ORG_ROLES.ORG_OWNER ||
  user.orgRole === ORG_ROLES.ORG_MANAGER ||
  user.projectRoles.includes(PROJECT_ROLES.PROJECT_MANAGER);

const _isTranslator = (user: AppPolicyUser): boolean =>
  user.projectRoles.includes(PROJECT_ROLES.TRANSLATOR);

export const ChapterAssignmentPolicy = {
  /**
   * Can this user edit the content of this chapter assignment?
   */
  edit(
    user: AppPolicyUser,
    assignment: PolicyChapterAssignment,
    isProjectMember: boolean
  ): boolean {
    if (user.orgId !== assignment.organizationId) {
      return false;
    }

    if (_isProjectManager(user)) {
      return (
        assignment.status === CHAPTER_ASSIGNMENT_STATUS.COMMUNITY_REVIEW ||
        assignment.status === CHAPTER_ASSIGNMENT_STATUS.LINGUIST_CHECK ||
        assignment.status === CHAPTER_ASSIGNMENT_STATUS.THEOLOGICAL_CHECK ||
        assignment.status === CHAPTER_ASSIGNMENT_STATUS.CONSULTANT_CHECK
      );
    }

    // future roles can be prevented access using this
    if (!_isTranslator(user)) {
      return false;
    }

    switch (assignment.status) {
      case CHAPTER_ASSIGNMENT_STATUS.DRAFT:
        return assignment.assignedUserId === user.id;

      case CHAPTER_ASSIGNMENT_STATUS.PEER_CHECK:
        return assignment.peerCheckerId === user.id;

      case CHAPTER_ASSIGNMENT_STATUS.COMMUNITY_REVIEW:
      case CHAPTER_ASSIGNMENT_STATUS.LINGUIST_CHECK:
      case CHAPTER_ASSIGNMENT_STATUS.THEOLOGICAL_CHECK:
      case CHAPTER_ASSIGNMENT_STATUS.CONSULTANT_CHECK:
        return isProjectMember;

      default:
        return false;
    }
  },

  /**
   * Can this user view a list of all chapter assignments in this org?
   */
  viewAll(user: AppPolicyUser, targetOrganizationId: number): boolean {
    return user.orgId === targetOrganizationId;
  },

  /**
   * Can this user view this specific chapter assignment?
   */
  view(user: AppPolicyUser, assignment: PolicyChapterAssignment): boolean {
    return user.orgId === assignment.organizationId;
  },

  /**
   * Can this user create a chapter assignment?
   */
  create(user: AppPolicyUser, targetOrganizationId: number): boolean {
    return _isProjectManager(user) && user.orgId === targetOrganizationId;
  },

  /**
   * Can this user update this chapter assignment (e.g., metadata, non-content)?
   */
  update(user: AppPolicyUser, assignment: PolicyChapterAssignment): boolean {
    return _isProjectManager(user) && user.orgId === assignment.organizationId;
  },

  /**
   * Can this user delete this chapter assignment?
   */
  delete(user: AppPolicyUser, assignment: PolicyChapterAssignment): boolean {
    return _isProjectManager(user) && user.orgId === assignment.organizationId;
  },

  /**
   * Can this user delete all chapter assignments for a project/org?
   */
  deleteAll(user: AppPolicyUser, targetOrganizationId: number): boolean {
    return _isProjectManager(user) && user.orgId === targetOrganizationId;
  },

  /**
   * Can this user assign all chapter assignments for a project/org?
   */
  assignAll(user: AppPolicyUser, targetOrganizationId: number): boolean {
    return _isProjectManager(user) && user.orgId === targetOrganizationId;
  },

  /**
   * Base assignment logic (Internal abstraction)
   */
  _assign(user: AppPolicyUser, assignment: PolicyChapterAssignment): boolean {
    return _isProjectManager(user) && user.orgId === assignment.organizationId;
  },

  /**
   * Can this user assign a drafter to this assignment?
   */
  assignDrafter(user: AppPolicyUser, assignment: PolicyChapterAssignment): boolean {
    return this._assign(user, assignment);
  },

  /**
   * Can this user assign a peer checker to this assignment?
   */
  assignPeerChecker(user: AppPolicyUser, assignment: PolicyChapterAssignment): boolean {
    return this._assign(user, assignment);
  },

  /**
   * Can this user submit (advance the status of) this assignment?
   */
  submit(
    user: AppPolicyUser,
    assignment: PolicyChapterAssignment,
    isProjectMember: boolean
  ): boolean {
    // 1. Strict Organization Boundary Check
    if (user.orgId !== assignment.organizationId) {
      return false;
    }

    if (_isProjectManager(user)) {
      return (
        assignment.status === CHAPTER_ASSIGNMENT_STATUS.COMMUNITY_REVIEW ||
        assignment.status === CHAPTER_ASSIGNMENT_STATUS.LINGUIST_CHECK ||
        assignment.status === CHAPTER_ASSIGNMENT_STATUS.THEOLOGICAL_CHECK ||
        assignment.status === CHAPTER_ASSIGNMENT_STATUS.CONSULTANT_CHECK
      );
    }

    if (!_isTranslator(user)) {
      return false;
    }

    // Refactored to use switch statement for expressive intent and consistency
    switch (assignment.status) {
      case CHAPTER_ASSIGNMENT_STATUS.DRAFT:
        return assignment.assignedUserId === user.id;

      case CHAPTER_ASSIGNMENT_STATUS.PEER_CHECK:
        return assignment.peerCheckerId === user.id;

      case CHAPTER_ASSIGNMENT_STATUS.COMMUNITY_REVIEW:
      case CHAPTER_ASSIGNMENT_STATUS.LINGUIST_CHECK:
      case CHAPTER_ASSIGNMENT_STATUS.THEOLOGICAL_CHECK:
      case CHAPTER_ASSIGNMENT_STATUS.CONSULTANT_CHECK:
        return isProjectMember;

      default:
        return false;
    }
  },

  /**
   * Is this user a direct participant in this assignment?
   */
  isParticipant(user: AppPolicyUser, assignment: PolicyChapterAssignment): boolean {
    // 1. Strict Organization Boundary Check
    if (user.orgId !== assignment.organizationId) {
      return false;
    }

    if (!_isTranslator(user)) {
      return false;
    }

    return assignment.assignedUserId === user.id || assignment.peerCheckerId === user.id;
  },
};
