import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { resolveIsProjectMember } from '@/domains/projects/project-users/project-users.handlers';
import { ProjectPolicy } from '@/domains/projects/project.policy';
import * as projectHandler from '@/domains/projects/projects.service';
import { getProjectIdByUnitId } from '@/domains/projects/projects.service';
import { PERMISSIONS } from '@/lib/permissions';
import { authenticateUser, requirePermission } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as chapterAssignmentsHandler from './chapter-assignments.handlers';
import { ChapterAssignmentPolicy } from './chapter-assignments.policy';

const chapterAssignmentResponse = z.object({
  id: z.number().int().optional(),
  projectUnitId: z.number().int(),
  bibleId: z.number().int(),
  bookId: z.number().int(),
  chapterNumber: z.number().int(),
  assignedUserId: z.number().int().nullable().optional(),
  peerCheckerId: z.number().int().nullable().optional(),
  status: z.enum(['not_started', 'draft', 'peer_check', 'community_review']).optional(),
  submittedTime: z.date().nullable().optional(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
});

// ─── POST /chapter-assignments ────────────────────────────────────────────────

const createChapterAssignmentRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'post',
  path: '/chapter-assignments',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.CONTENT_ASSIGN)] as const,
  request: {
    body: jsonContent(
      z.object({
        projectUnitId: z.number().int(),
        bibleId: z.number().int(),
        bookId: z.number().int(),
        chapterNumber: z.number().int(),
        assignedUserId: z.number().int().optional(),
        peerCheckerId: z.number().int().optional(),
      }),
      'Chapter assignment data'
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      chapterAssignmentResponse,
      'The created chapter assignment'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Validation error or constraint violation'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'You do not have permission to create chapter assignments for this project.'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project unit or project not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.object({
        success: z.boolean(),
        error: z.object({
          issues: z.array(
            z.object({ code: z.string(), path: z.array(z.string()), message: z.string() })
          ),
          name: z.string(),
          message: z.string(),
        }),
        message: z.string(),
      }),
      'Unprocessable entity'
    ),
  },
  summary: 'Create a new chapter assignment',
  description: 'Creates a new chapter assignment.',
});

server.openapi(createChapterAssignmentRoute, async (c) => {
  const requestData = c.req.valid('json');
  const user = c.get('user')!;
  const policyUser = { id: user.id, roleName: user.roleName, organization: user.organization };

  const unitResult = await getProjectIdByUnitId(requestData.projectUnitId);
  if (!unitResult.ok) {
    return c.json({ message: 'Project unit not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const projectResult = await projectHandler.getProjectById(unitResult.data.projectId);
  if (!projectResult.ok) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  if (!ChapterAssignmentPolicy.create(policyUser, projectResult.data.organization)) {
    return c.json(
      { message: 'Forbidden: You do not have permission to create assignments.' },
      HttpStatusCodes.FORBIDDEN
    );
  }

  const result = await chapterAssignmentsHandler.createChapterAssignment(requestData);
  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.CREATED);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
});

// ─── PATCH /chapter-assignments/:chapterAssignmentId ─────────────────────────

const updateChapterAssignmentRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'patch',
  path: '/chapter-assignments/{chapterAssignmentId}',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.CONTENT_ASSIGN)] as const,
  request: {
    params: z.object({
      chapterAssignmentId: z.coerce.number().int().positive(),
    }),
    body: jsonContent(
      z.object({
        assignedUserId: z.number().int(),
        peerCheckerId: z.number().int(),
      }),
      'Users to assign to the chapter assignment.'
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(chapterAssignmentResponse, 'The updated chapter assignment'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Validation error or constraint violation'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'You do not have permission to update this chapter assignment.'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Chapter assignment not found'
    ),
  },
  summary: 'Update a chapter assignment',
  description: 'Updates a chapter assignment.',
});

server.openapi(updateChapterAssignmentRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');
  const requestData = c.req.valid('json');
  const user = c.get('user')!;
  const policyUser = { id: user.id, roleName: user.roleName, organization: user.organization };

  const assignmentResult =
    await chapterAssignmentsHandler.getChapterAssignment(chapterAssignmentId);
  if (!assignmentResult.ok) {
    return c.json({ message: assignmentResult.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  // Passing the actual DB result directly
  if (!ChapterAssignmentPolicy.update(policyUser, assignmentResult.data)) {
    return c.json(
      { message: 'Forbidden: You do not have permission to update assignments.' },
      HttpStatusCodes.FORBIDDEN
    );
  }

  const result = await chapterAssignmentsHandler.updateChapterAssignment(
    chapterAssignmentId,
    requestData
  );
  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
});

// ─── PATCH /chapter-assignments/:chapterAssignmentId/submit ──────────────────

const submitChapterAssignmentRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'patch',
  path: '/chapter-assignments/{chapterAssignmentId}/submit',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.CONTENT_UPDATE)] as const,
  request: {
    params: z.object({
      chapterAssignmentId: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      chapterAssignmentResponse,
      'The submitted chapter assignment'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Validation error or constraint violation'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'You do not have permission to submit this chapter assignment.'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Chapter assignment not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Submit a chapter assignment',
  description:
    'Advances chapter assignment to next stage: draft → peer_check → community_review. Sets submission timestamp.',
});

server.openapi(submitChapterAssignmentRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');
  const user = c.get('user')!;
  const policyUser = { id: user.id, roleName: user.roleName, organization: user.organization };

  const getResult = await chapterAssignmentsHandler.getChapterAssignment(chapterAssignmentId);
  if (!getResult.ok) {
    return c.json({ message: getResult.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  const unitResult = await getProjectIdByUnitId(getResult.data.projectUnitId);
  const isProjectMember = unitResult.ok
    ? await resolveIsProjectMember(unitResult.data.projectId, user.id, user.roleName)
    : false;

  // Passing the actual DB result directly
  if (!ChapterAssignmentPolicy.submit(policyUser, getResult.data, isProjectMember)) {
    return c.json(
      { message: 'Forbidden: You do not have permission to submit this assignment right now.' },
      HttpStatusCodes.FORBIDDEN
    );
  }

  const result = await chapterAssignmentsHandler.submitChapterAssignment(chapterAssignmentId);
  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  if (result.error.message === 'Chapter assignment not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  if (result.error.message.includes('Cannot submit assignment')) {
    return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

// ─── GET /chapter-assignments/:chapterAssignmentId ────────────────────────────

const getChapterAssignmentRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'get',
  path: '/chapter-assignments/{chapterAssignmentId}',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
  request: {
    params: z.object({
      chapterAssignmentId: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(chapterAssignmentResponse, 'The chapter assignment'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'You do not have permission to get this chapter assignment.'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Chapter assignment not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get a chapter assignment',
  description: 'Get a chapter assignment.',
});

server.openapi(getChapterAssignmentRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const result = await chapterAssignmentsHandler.getChapterAssignment(chapterAssignmentId);
  if (!result.ok) {
    return result.error.message === 'Chapter assignment not found'
      ? c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND)
      : c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const unitResult = await getProjectIdByUnitId(result.data.projectUnitId);
  if (!unitResult.ok) {
    return c.json({ message: 'Chapter assignment not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const projectResult = await projectHandler.getProjectById(unitResult.data.projectId);
  if (!projectResult.ok) {
    return c.json({ message: 'Chapter assignment not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const isProjectMember = await resolveIsProjectMember(
    unitResult.data.projectId,
    currentUser.id,
    currentUser.roleName
  );

  if (!ProjectPolicy.read(policyUser, projectResult.data, isProjectMember)) {
    return c.json(
      { message: 'Forbidden: You do not have permission to view this assignment.' },
      HttpStatusCodes.FORBIDDEN
    );
  }

  return c.json(result.data, HttpStatusCodes.OK);
});

// ─── DELETE /chapter-assignments/:chapterAssignmentId ────────────────────────

const deleteChapterAssignmentRoute = createRoute({
  tags: ['Chapter Assignments'],
  method: 'delete',
  path: '/chapter-assignments/{chapterAssignmentId}',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.CONTENT_ASSIGN)] as const,
  request: {
    params: z.object({
      chapterAssignmentId: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Chapter assignment deleted',
    },
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'You do not have permission to delete this chapter assignment.'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Chapter assignment not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Delete a chapter assignment',
  description: 'Delete a chapter assignment.',
});

server.openapi(deleteChapterAssignmentRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');
  const user = c.get('user')!;
  const policyUser = { id: user.id, roleName: user.roleName, organization: user.organization };

  const assignmentResult =
    await chapterAssignmentsHandler.getChapterAssignment(chapterAssignmentId);
  if (!assignmentResult.ok) {
    return c.json({ message: assignmentResult.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  // Passing the actual DB result directly
  if (!ChapterAssignmentPolicy.delete(policyUser, assignmentResult.data)) {
    return c.json(
      { message: 'Forbidden: You do not have permission to delete assignments.' },
      HttpStatusCodes.FORBIDDEN
    );
  }

  const result = await chapterAssignmentsHandler.deleteChapterAssignment(chapterAssignmentId);
  if (result.ok) {
    return c.body(null, HttpStatusCodes.NO_CONTENT);
  }

  if (result.error.message === 'Chapter assignment not found') {
    return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
