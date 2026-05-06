import { createMiddleware } from 'hono/factory';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { ProjectRoleName } from '@/lib/roles';
import type { Result } from '@/lib/types';
import type { AppEnv } from '@/server/context.types';

import { getProjectRolesForUser } from '@/domains/projects/users/project-users.service';
import { ORG_ROLES } from '@/lib/roles';
import { getHttpStatus } from '@/lib/types';

import type { ChapterAssignmentWithAuthContext } from './chapter-assignments.repository';
import type { ChapterAssignmentAction } from './chapter-assignments.types';

import { ChapterAssignmentPolicy } from './chapter-assignments.policy';
import * as chapterAssignmentService from './chapter-assignments.service';
import { CHAPTER_ASSIGNMENT_ACTIONS } from './chapter-assignments.types';

// Loads a chapter assignment with auth context and evaluates the policy.
export function requireChapterAssignmentAccess(
  action: ChapterAssignmentAction,
  paramName = 'chapterAssignmentId'
) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')!;
    const orgMembership = c.get('orgMembership');

    const chapterAssignmentId = Number(c.req.param(paramName));
    if (!chapterAssignmentId || Number.isNaN(chapterAssignmentId)) {
      return c.json({ message: 'Missing chapter assignment ID' }, HttpStatusCodes.BAD_REQUEST);
    }

    const result: Result<ChapterAssignmentWithAuthContext> =
      await chapterAssignmentService.getChapterAssignmentWithAuthContext(chapterAssignmentId);

    if (!result.ok) {
      return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
    }

    const ctx = result.data;

    const projectRolesResult = await getProjectRolesForUser(ctx.projectId, user.id);
    const projectRoles = (
      projectRolesResult.ok ? projectRolesResult.data : []
    ) as ProjectRoleName[];
    const isProjectMember = projectRoles.length > 0;

    const policyUser = {
      id: user.id,
      orgId: orgMembership?.orgId ?? ctx.organizationId,
      orgRole: orgMembership?.orgRole ?? ORG_ROLES.MEMBER,
      projectRoles,
    };

    const policyAssignment = {
      organizationId: ctx.organizationId,
      assignedUserId: ctx.assignedUserId,
      peerCheckerId: ctx.peerCheckerId,
      status: ctx.status,
    };

    let allowed = false;
    switch (action) {
      case CHAPTER_ASSIGNMENT_ACTIONS.READ:
        allowed = ChapterAssignmentPolicy.view(policyUser, policyAssignment);
        break;

      case CHAPTER_ASSIGNMENT_ACTIONS.UPDATE:
        allowed = ChapterAssignmentPolicy.update(policyUser, policyAssignment);
        break;

      case CHAPTER_ASSIGNMENT_ACTIONS.SUBMIT:
        allowed = ChapterAssignmentPolicy.submit(policyUser, policyAssignment, isProjectMember);
        break;

      case CHAPTER_ASSIGNMENT_ACTIONS.DELETE:
        allowed = ChapterAssignmentPolicy.delete(policyUser, policyAssignment);
        break;

      case CHAPTER_ASSIGNMENT_ACTIONS.IS_PARTICIPANT:
        allowed = ChapterAssignmentPolicy.isParticipant(policyUser, policyAssignment);
        break;
    }

    if (!allowed) {
      return c.json({ message: 'Chapter assignment not found' }, HttpStatusCodes.NOT_FOUND);
    }

    c.set('chapterAssignment', ctx);
    return next();
  });
}
