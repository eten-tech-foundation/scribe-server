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
 *     view / viewProject → yes, always — org is already enforced by the data
 *                          model (assignments live inside projects which are
 *                          org-scoped). requirePermission is sufficient.
 *     manage             → yes, same reason — no extra check needed.
 *
 *   Translator:
 *     view / viewProject → yes, if they are in project_users for this project.
 *                          `isProjectMember` is resolved inline in the route
 *                          using the projectId already available from the URL
 *                          param or from the fetched assignment's projectUnitId.
 *     edit (draft)            → only the assignedUserId
 *     edit (peer_check)       → only the peerCheckerId
 *     edit (community_review) → any project member
 *     edit (not_started)      → nobody
 *     submit (draft)       → assignedUserId → advances to peer_check
 *     submit (peer_check)  → peerCheckerId  → advances to community_review
 *
 * ─── What the route resolves before calling policy ───────────────────────────
 *   isProjectMember — one inline query on project_users, no handler helper needed:
 *
 *     const [member] = await db
 *       .select()
 *       .from(project_users)
 *       .where(and(
 *         eq(project_users.projectId, projectId),
 *         eq(project_users.userId, currentUser.id)
 *       ))
 *       .limit(1);
 *     const isProjectMember = member !== undefined;
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
   * Can this user view this chapter assignment or a project's chapter list?
   *
   * Manager    : yes — org is already enforced by the data model.
   * Translator : yes, if they are in project_users for this project.
   */
  view(user: PolicyUser, isProjectMember: boolean): boolean {
    if (user.roleName === ROLES.PROJECT_MANAGER) {
      return true;
    }

    if (user.roleName === ROLES.TRANSLATOR) {
      return isProjectMember;
    }

    return false;
  },

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
};
