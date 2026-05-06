import { createMiddleware } from 'hono/factory';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { ProjectRoleName } from '@/lib/roles';
import type { AppEnv } from '@/server/context.types';

import { ORG_ROLES } from '@/lib/roles';
import { getHttpStatus } from '@/lib/types';

import type { ProjectAction } from './projects.types';

import { ProjectPolicy } from './project.policy';
import * as projectService from './projects.service';
import { PROJECT_ACTIONS } from './projects.types';
import { getProjectRolesForUser, resolveIsProjectMember } from './users/project-users.service';

export function requireProjectAccess(action: ProjectAction, paramName = 'id') {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')!;
    const orgMembership = c.get('orgMembership');

    const orgRole = orgMembership?.orgRole ?? ORG_ROLES.MEMBER;
    const orgId = orgMembership?.orgId ?? 0;

    const policyUser = {
      id: user.id,
      orgId,
      orgRole,
      projectRoles: [] as ProjectRoleName[],
    };

    if (action === PROJECT_ACTIONS.LIST) {
      if (!ProjectPolicy.list(policyUser)) {
        return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);
      }
      return next();
    }

    const projectId = Number(c.req.param(paramName));
    if (!projectId || Number.isNaN(projectId)) {
      return c.json({ message: 'Missing project ID' }, HttpStatusCodes.BAD_REQUEST);
    }

    const result = await projectService.getProjectById(projectId);
    if (!result.ok) {
      return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
    }

    const project = result.data;

    const projectRolesResult = await getProjectRolesForUser(projectId, user.id);
    const projectRoles = projectRolesResult.ok
      ? (projectRolesResult.data as ProjectRoleName[])
      : [];
    policyUser.projectRoles = projectRoles;

    let allowed = false;
    let isProjectMember = false;

    switch (action) {
      case PROJECT_ACTIONS.READ:
        isProjectMember = await resolveIsProjectMember(projectId, user.id);
        allowed = ProjectPolicy.read(policyUser, project, isProjectMember);
        break;
      case PROJECT_ACTIONS.UPDATE:
        allowed = ProjectPolicy.update(policyUser, project);
        break;
      case PROJECT_ACTIONS.DELETE:
        allowed = ProjectPolicy.delete(policyUser, project);
        break;
    }

    if (!allowed) {
      return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
    }

    c.set('project', project);
    if (action === PROJECT_ACTIONS.READ) {
      c.set('projectAuthContext', { isProjectMember, projectRoles });
    }
    return next();
  });
}
