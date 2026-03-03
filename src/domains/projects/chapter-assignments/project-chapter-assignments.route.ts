import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { ChapterAssignmentPolicy } from '@/domains/chapter-assignments/chapter-assignments.policy';
import { resolveIsProjectMember } from '@/domains/projects/project-users/project-users.handlers';
import { ProjectPolicy } from '@/domains/projects/project.policy';
import * as projectHandler from '@/domains/projects/projects.handlers';
import { PERMISSIONS } from '@/lib/permissions';
import { authenticateUser, requirePermission } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as projectChapterAssignmentsHandler from './project-chapter-assignments.handlers';

// ─── Shared response schemas ──────────────────────────────────────────────────

export const chapterAssignmentResponse = z.object({
  id: z.number().int().optional(),
  projectUnitId: z.number().int(),
  bibleId: z.number().int(),
  bookId: z.number().int(),
  chapterNumber: z.number().int(),
  assignedUserId: z.number().int().nullable().optional(),
  submittedTime: z.date().nullable().optional(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
});

const userResponse = z.object({
  id: z.number().int(),
  displayName: z.string(),
});

const chapterAssignmentProgressResponse = z.object({
  assignmentId: z.number(),
  projectUnitId: z.number(),
  status: z.string(),
  bookNameEng: z.string(),
  chapterNumber: z.number(),
  assignedUser: z.nullable(userResponse),
  peerChecker: z.nullable(userResponse),
  totalVerses: z.number().int(),
  completedVerses: z.number().int(),
  submittedTime: z.date().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

// ─── GET /projects/:projectId/chapter-assignments ─────────────────────────────

const getProjectChapterAssignmentsRoute = createRoute({
  tags: ['Projects - Chapter Assignments'],
  method: 'get',
  path: '/projects/{projectId}/chapter-assignments',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
  request: {
    params: z.object({ projectId: z.coerce.number().int().positive() }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      chapterAssignmentResponse.array().openapi('Project Chapter Assignments'),
      'The list of chapter assignments for the project'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Project access required'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get project chapter assignments',
  description: 'Returns a list of chapter assignments for the project',
});

server.openapi(getProjectChapterAssignmentsRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const projectResult = await projectHandler.getProjectById(projectId);
  if (!projectResult.ok) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const isProjectMember = await resolveIsProjectMember(
    projectId,
    currentUser.id,
    currentUser.roleName
  );

  if (!ProjectPolicy.read(policyUser, projectResult.data, isProjectMember)) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const result = await projectChapterAssignmentsHandler.getProjectChapterAssignments(projectId);
  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

// ─── DELETE /projects/:projectId/chapter-assignments ─────────────────────────

const deleteProjectChapterAssignmentsRoute = createRoute({
  tags: ['Projects - Chapter Assignments'],
  method: 'delete',
  path: '/projects/{projectId}/chapter-assignments',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.CONTENT_ASSIGN)] as const,
  request: {
    params: z.object({ projectId: z.coerce.number().int().positive() }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ deletedCount: z.number().int() }).openapi('DeleteResult'),
      'Successfully deleted chapter assignments'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Manager access required'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Delete all chapter assignments for a project',
  description: 'Deletes all chapter assignments associated with a specific project. Manager only.',
});

server.openapi(deleteProjectChapterAssignmentsRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const projectResult = await projectHandler.getProjectById(projectId);
  if (!projectResult.ok) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  // Using the new org-level bulk action check
  if (!ChapterAssignmentPolicy.deleteAll(policyUser, projectResult.data.organization)) {
    return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);
  }

  const result =
    await projectChapterAssignmentsHandler.deleteChapterAssignmentsByProject(projectId);
  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

// ─── GET /projects/:projectId/chapter-assignments/progress ───────────────────

const getChapterAssignmentProgressForProjectRoute = createRoute({
  tags: ['Projects - Chapter Assignments'],
  method: 'get',
  path: '/projects/{projectId}/chapter-assignments/progress',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
  request: {
    params: z.object({ projectId: z.coerce.number().int().positive() }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      chapterAssignmentProgressResponse.array().openapi('ChapterAssignmentProgress'),
      'Chapter assignment progress for the project'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Project access required'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get chapter assignment progress',
  description: 'Returns chapter assignment with progress completion statistics for a project',
});

server.openapi(getChapterAssignmentProgressForProjectRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const projectResult = await projectHandler.getProjectById(projectId);
  if (!projectResult.ok) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const isProjectMember = await resolveIsProjectMember(
    projectId,
    currentUser.id,
    currentUser.roleName
  );

  if (!ProjectPolicy.read(policyUser, projectResult.data, isProjectMember)) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const result =
    await projectChapterAssignmentsHandler.getChapterAssignmentProgressByProject(projectId);
  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

// ─── PATCH /projects/:projectId/chapter-assignments/assign-all ───────────────

const assignAllProjectChapterAssignmentsToUserRoute = createRoute({
  tags: ['Projects - Chapter Assignments'],
  method: 'patch',
  path: '/projects/{projectId}/chapter-assignments/assign-all',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.CONTENT_ASSIGN)] as const,
  request: {
    params: z.object({ projectId: z.coerce.number().int().positive() }),
    body: jsonContent(
      z.object({ assignedUserId: z.number().int() }),
      'Id of User to assign to all chapters.'
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      chapterAssignmentResponse.array().openapi('ProjectChapterAssignAll'),
      'Successfully assigned users to chapters'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Invalid request data or assigned user is not in project organization'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Manager access required'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Assign user to all chapters for a project',
  description: 'Assign user to all chapters for a project. Manager only.',
});

server.openapi(assignAllProjectChapterAssignmentsToUserRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const assignmentData = c.req.valid('json');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const projectResult = await projectHandler.getProjectById(projectId);
  if (!projectResult.ok) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  // Using the new org-level bulk action check
  if (!ChapterAssignmentPolicy.assignAll(policyUser, projectResult.data.organization)) {
    return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);
  }

  const result = await projectChapterAssignmentsHandler.assignAllProjectChapterAssignmentsToUser(
    projectId,
    assignmentData
  );

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message === 'Assigned user is not in project organization') {
    return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
