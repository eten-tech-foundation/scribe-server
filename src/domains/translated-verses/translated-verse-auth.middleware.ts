import { createMiddleware } from 'hono/factory';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppEnv } from '@/server/context.types';

import { ChapterAssignmentPolicy } from '@/domains/chapter-assignments/chapter-assignments.policy';
import * as chapterAssignmentService from '@/domains/chapter-assignments/chapter-assignments.service';
import { ProjectPolicy } from '@/domains/projects/project.policy';
import * as projectService from '@/domains/projects/projects.service';
import { resolveIsProjectMember } from '@/domains/projects/users/project-users.service';

import * as translatedVersesService from './translated-verses.service';

export type TranslatedVerseAction = 'read' | 'edit';
export type ProjectUnitIdSource = 'verseParam' | 'query' | 'body';

// Body fields the middleware needs for auth resolution.
interface TranslatedVerseAuthBody {
  projectUnitId: number;
  bibleTextId: number;
}

// Resolves the parent project or assignment and evaluates the appropriate policy.
export function requireTranslatedVerseAccess(
  action: TranslatedVerseAction,
  source: ProjectUnitIdSource,
  verseParamName = 'id'
) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')!;
    const policyUser = {
      id: user.id,
      role: user.role,
      roleName: user.roleName,
      organization: user.organization,
    };

    let projectUnitId: number | undefined;
    let parsedBody: TranslatedVerseAuthBody | undefined;

    if (source === 'verseParam') {
      const verseId = Number(c.req.param(verseParamName));
      if (!verseId || Number.isNaN(verseId)) {
        return c.json({ message: 'Missing verse ID' }, HttpStatusCodes.BAD_REQUEST);
      }

      const verseResult = await translatedVersesService.getTranslatedVerseById(verseId);
      if (!verseResult.ok) {
        return c.json({ message: 'Translated verse not found' }, HttpStatusCodes.NOT_FOUND);
      }

      c.set('translatedVerse', verseResult.data);
      projectUnitId = verseResult.data.projectUnitId;
    } else if (source === 'query') {
      projectUnitId = Number(c.req.query('projectUnitId'));
    } else if (source === 'body') {
      parsedBody = await c.req.json();
      projectUnitId = parsedBody?.projectUnitId;
    }

    if (!projectUnitId || Number.isNaN(projectUnitId)) {
      return c.json({ message: 'Missing projectUnitId' }, HttpStatusCodes.BAD_REQUEST);
    }

    if (action === 'read') {
      const unitResult = await projectService.getProjectIdByUnitId(projectUnitId);
      if (!unitResult.ok) {
        return c.json({ message: 'Translated verse not found' }, HttpStatusCodes.NOT_FOUND);
      }

      const projectResult = await projectService.getProjectById(unitResult.data.projectId);
      if (!projectResult.ok) {
        return c.json({ message: 'Translated verse not found' }, HttpStatusCodes.NOT_FOUND);
      }

      const isProjectMember = await resolveIsProjectMember(
        unitResult.data.projectId,
        user.id,
        user.roleName
      );

      if (!ProjectPolicy.read(policyUser, projectResult.data, isProjectMember)) {
        return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);
      }

      c.set('project', projectResult.data);
      c.set('projectAuthContext', { isProjectMember });
    } else if (action === 'edit') {
      // Reuse already-parsed body from source resolution
      const body = parsedBody ?? (await c.req.json() as TranslatedVerseAuthBody);

      const assignmentResult = await chapterAssignmentService.getAssignmentForVerse(
        body.projectUnitId,
        body.bibleTextId
      );
      if (!assignmentResult.ok) {
        return c.json({ message: assignmentResult.error.message }, HttpStatusCodes.BAD_REQUEST);
      }

      const unitResult = await projectService.getProjectIdByUnitId(projectUnitId);
      const isProjectMember = unitResult.ok
        ? await resolveIsProjectMember(unitResult.data.projectId, user.id, user.roleName)
        : false;

      if (!ChapterAssignmentPolicy.edit(policyUser, assignmentResult.data, isProjectMember)) {
        return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);
      }
    }

    return next();
  });
}
