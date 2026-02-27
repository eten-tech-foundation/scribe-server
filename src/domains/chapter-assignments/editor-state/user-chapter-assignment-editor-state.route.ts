import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import {
  editorStateResourcesSchema,
  insertUserChapterAssignmentEditorStateSchema,
} from '@/db/schema';
import * as chapterAssignmentsHandler from '@/domains/chapter-assignments/chapter-assignments.handlers';
import { ChapterAssignmentPolicy } from '@/domains/chapter-assignments/chapter-assignments.policy';
import { PERMISSIONS } from '@/lib/permissions';
import { authenticateUser, requirePermission } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as editorStateHandler from './user-chapter-assignment-editor-state.handlers';

const chapterAssignmentIdParam = z.object({
  chapterAssignmentId: z.coerce
    .number()
    .int()
    .positive()
    .openapi({
      param: { name: 'chapterAssignmentId', in: 'path', required: true },
      description: 'Chapter assignment ID',
      example: 1,
    }),
});

// ─── GET /chapter-assignments/:chapterAssignmentId/editor-state ───────────────

const getEditorStateRoute = createRoute({
  tags: ['Chapter Assignments - Editor State'],
  method: 'get',
  path: '/chapter-assignments/{chapterAssignmentId}/editor-state',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.CONTENT_DRAFT)] as const,
  request: {
    params: chapterAssignmentIdParam,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      editorStateResourcesSchema,
      'The editor state for the current user (null if not previously saved)'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Access denied'
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
  summary: 'Get editor state for current user',
  description:
    'Returns the saved editor state (last opened resources) for the current user and specified chapter assignment. Returns null if no state has been saved yet.',
});

server.openapi(getEditorStateRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');
  const currentUser = c.get('user')!;
  // organization required by isParticipant() for the org-boundary check.
  const policyUser = {
    id: currentUser.id,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const assignmentResult =
    await chapterAssignmentsHandler.getChapterAssignment(chapterAssignmentId);
  if (!assignmentResult.ok) {
    return assignmentResult.error.message === 'Chapter assignment not found'
      ? c.json({ message: assignmentResult.error.message }, HttpStatusCodes.NOT_FOUND)
      : c.json({ message: assignmentResult.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const policyAssignment = {
    assignedUserId: assignmentResult.data.assignedUserId,
    peerCheckerId: assignmentResult.data.peerCheckerId,
    status: assignmentResult.data.status,
    // isParticipant() now checks org to prevent a translator from one org
    // accessing editor state belonging to another org's assignment.
    organizationId: assignmentResult.data.organizationId,
  };

  if (!ChapterAssignmentPolicy.isParticipant(policyUser, policyAssignment)) {
    return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);
  }

  const result = await editorStateHandler.getEditorState(currentUser.id, chapterAssignmentId);
  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});

// ─── PUT /chapter-assignments/:chapterAssignmentId/editor-state ───────────────

const saveEditorStateRoute = createRoute({
  tags: ['Chapter Assignments - Editor State'],
  method: 'put',
  path: '/chapter-assignments/{chapterAssignmentId}/editor-state',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.CONTENT_DRAFT)] as const,
  request: {
    params: chapterAssignmentIdParam,
    body: jsonContent(
      insertUserChapterAssignmentEditorStateSchema
        .omit({ userId: true, chapterAssignmentId: true })
        .openapi('EditorStateInput'),
      'The editor state to save (last opened resources)'
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(editorStateResourcesSchema, 'The saved editor state'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema('Bad Request'),
      'Invalid request data'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Access denied'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Chapter assignment not found'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.object({
        success: z.boolean(),
        error: z.object({
          issues: z.array(
            z.object({ code: z.string(), path: z.array(z.string()), message: z.string() })
          ),
          name: z.string(),
        }),
      }),
      'Validation error'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Save editor state for current user',
  description:
    'Saves or updates the editor state (selected resources) for the current user and chapter assignment. Idempotent.',
});

server.openapi(saveEditorStateRoute, async (c) => {
  const { chapterAssignmentId } = c.req.valid('param');
  const editorStateData = c.req.valid('json');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const assignmentResult =
    await chapterAssignmentsHandler.getChapterAssignment(chapterAssignmentId);
  if (!assignmentResult.ok) {
    return assignmentResult.error.message === 'Chapter assignment not found'
      ? c.json({ message: assignmentResult.error.message }, HttpStatusCodes.NOT_FOUND)
      : c.json({ message: assignmentResult.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const policyAssignment = {
    assignedUserId: assignmentResult.data.assignedUserId,
    peerCheckerId: assignmentResult.data.peerCheckerId,
    status: assignmentResult.data.status,
    // Same org-boundary requirement as the GET above.
    organizationId: assignmentResult.data.organizationId,
  };

  if (!ChapterAssignmentPolicy.isParticipant(policyUser, policyAssignment)) {
    return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);
  }

  const result = await editorStateHandler.upsertEditorState({
    userId: currentUser.id,
    chapterAssignmentId,
    ...editorStateData,
  });

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
