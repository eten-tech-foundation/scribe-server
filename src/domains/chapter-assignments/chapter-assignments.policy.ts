/**
 * src/domains/chapter-assignments/chapter-assignment.policy.ts
 *
 * Record-level access rules for chapter assignments.
 *
 * Called AFTER requirePermission() has confirmed the role has the permission.
 *
 * ─── Full rule set ────────────────────────────────────────────────────────────
 *
 *   Manager:
 *     viewProject → access is controlled by ProjectPolicy.read() in the route,
 *                   which already enforces org-scoping via the data model.
 *     manage      → yes — no extra check needed beyond org isolation.
 *
 *   Translator:
 *     viewProject        → yes, if they are in project_users for this project.
 *                          Enforced by ProjectPolicy.read() in the route.
 *     edit (draft)            → only the assignedUserId
 *     edit (peer_check)       → only the peerCheckerId
 *     edit (community_review) → any project member
 *     edit (not_started)      → nobody
 *     submit (draft)       → assignedUserId → advances to peer_check
 *     submit (peer_check)  → peerCheckerId  → advances to community_review
 *     isParticipant        → assignedUserId or peerCheckerId (status-independent)
 *
 * ─── What the route resolves before calling policy ───────────────────────────
 *   isProjectMember — resolved via resolveIsProjectMember() from
 *   domains/projects/project-users/project-users.handlers.ts
 *
 * ─── Note on "view" access ───────────────────────────────────────────────────
 *   Routes that list or read chapter assignments gate access with
 *   ProjectPolicy.read(), which already encodes the same rule:
 *     - Manager    → yes if same org
 *     - Translator → yes if in project_users
 *   A separate ChapterAssignmentPolicy.view() would be redundant.
 */

import { ROLES } from '@/lib/roles';

interface PolicyUser {
  id: number;
  roleName: string;
}

export interface PolicyChapterAssignment {
  assignedUserId: number | null;
  peerCheckerId: number | null;
  status: string;
}

export const ChapterAssignmentPolicy = {
  /**
   * Can this user edit the content of this chapter assignment?
   *
   * Edit means writing translated verses — not assigning users.
   *
   * Manager    : never (managers assign, translators write).
   *
   * Translator:
   *   draft            → only the assignedUserId
   *   peer_check       → only the peerCheckerId
   *   community_review → any project member
   *   not_started      → nobody (no one assigned yet)
   */
  edit(user: PolicyUser, assignment: PolicyChapterAssignment, isProjectMember: boolean): boolean {
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
   *
   * Manager    : yes — requirePermission confirmed content:assign and the
   *              data model already ensures org isolation.
   * Translator : never has content:assign, never reaches here.
   */
  manage(user: PolicyUser): boolean {
    return user.roleName === ROLES.PROJECT_MANAGER;
  },

  /**
   * Can this user submit (advance the status of) this assignment?
   *
   * Translator only. requirePermission gates content:draft.
   *
   *   draft      → assignedUserId submits → advances to peer_check
   *   peer_check → peerCheckerId submits  → advances to community_review
   *
   * Any other status cannot be submitted.
   */
  submit(user: PolicyUser, assignment: PolicyChapterAssignment): boolean {
    if (user.roleName !== ROLES.TRANSLATOR) {
      return false;
    }

    if (assignment.status === 'draft') {
      return assignment.assignedUserId === user.id;
    }

    if (assignment.status === 'peer_check') {
      return assignment.peerCheckerId === user.id;
    }

    return false;
  },

  /**
   * Is this user a direct participant (drafter or peer checker) in this
   * assignment, regardless of its current status?
   *
   * Used by the editor-state routes which are personal UI state keyed to
   * a specific user+assignment pair. Both the drafter and the peer checker
   * should be able to read and write their own editor state at any point.
   *
   * Translator only — managers never use the editor.
   */
  isParticipant(user: PolicyUser, assignment: PolicyChapterAssignment): boolean {
    if (user.roleName !== ROLES.TRANSLATOR) {
      return false;
    }

    return assignment.assignedUserId === user.id || assignment.peerCheckerId === user.id;
  },
};
