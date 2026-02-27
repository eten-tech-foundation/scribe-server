import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { insertTranslatedVersesSchema, selectTranslatedVersesSchema } from '@/db/schema';
import { getAssignmentForVerse } from '@/domains/chapter-assignments/chapter-assignments.handlers';
import { ChapterAssignmentPolicy } from '@/domains/chapter-assignments/chapter-assignments.policy';
import { resolveIsProjectMember } from '@/domains/projects/project-users/project-users.handlers';
import { ProjectPolicy } from '@/domains/projects/project.policy';
import * as projectHandler from '@/domains/projects/projects.handlers';
import { getProjectIdByUnitId } from '@/domains/projects/projects.handlers';
import { PERMISSIONS } from '@/lib/permissions';
import { authenticateUser, requirePermission } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as translatedVersesHandler from './translated-verses.handlers';

// ─── GET /translated-verses/:id ───────────────────────────────────────────────

const getTranslatedVerseRoute = createRoute({
  tags: ['Translated Verses'],
  method: 'get',
  path: '/translated-verses/{id}',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: { name: 'id', in: 'path', required: true, allowReserved: false },
        description: 'Translated verse ID',
        example: 77,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTranslatedVersesSchema, 'The translated verse'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Translated verse not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Access denied'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Get a translated verse by ID',
  description: 'Returns a single translated verse by its translated_verses.id',
});

server.openapi(getTranslatedVerseRoute, async (c) => {
  const { id } = c.req.valid('param');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const verseResult = await translatedVersesHandler.getTranslatedVerseById(id);
  if (!verseResult.ok) {
    return verseResult.error.message === 'Translated verse not found'
      ? c.json({ message: verseResult.error.message }, HttpStatusCodes.NOT_FOUND)
      : c.json({ message: verseResult.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const unitResult = await getProjectIdByUnitId(verseResult.data.projectUnitId);
  if (!unitResult.ok) {
    return c.json({ message: 'Translated verse not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const projectResult = await projectHandler.getProjectById(unitResult.data.projectId);
  if (!projectResult.ok) {
    return c.json({ message: 'Translated verse not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const isProjectMember = await resolveIsProjectMember(
    unitResult.data.projectId,
    currentUser.id,
    currentUser.roleName
  );

  if (!ProjectPolicy.read(policyUser, projectResult.data, isProjectMember)) {
    return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);
  }

  return c.json(verseResult.data, HttpStatusCodes.OK);
});

// ─── POST /translated-verses ──────────────────────────────────────────────────

const upsertTranslatedVerseRoute = createRoute({
  tags: ['Translated Verses'],
  method: 'post',
  path: '/translated-verses',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.CONTENT_DRAFT)] as const,
  request: {
    body: jsonContent(insertTranslatedVersesSchema, 'The translated verse to create or update'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectTranslatedVersesSchema,
      'The created or updated translated verse'
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
      'Access denied'
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
      'The validation error'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'Create or update a translated verse',
  description: 'Creates a new translated verse or updates an existing one. Translator only.',
});

server.openapi(upsertTranslatedVerseRoute, async (c) => {
  const translatedVerseData = c.req.valid('json');
  const currentUser = c.get('user')!;
  // organization is required by edit() for the org-boundary check.
  const policyUser = {
    id: currentUser.id,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  if (!translatedVerseData.assignedUserId) {
    translatedVerseData.assignedUserId = currentUser.id;
  }

  // getAssignmentForVerse now also joins project_units → projects and returns
  // organizationId on the PolicyChapterAssignment, so edit() can verify the
  // translator belongs to the same tenant as the assignment.
  const assignmentResult = await getAssignmentForVerse(
    translatedVerseData.projectUnitId,
    translatedVerseData.bibleTextId
  );
  if (!assignmentResult.ok) {
    return c.json({ message: assignmentResult.error.message }, HttpStatusCodes.BAD_REQUEST);
  }

  const unitResult = await getProjectIdByUnitId(translatedVerseData.projectUnitId);
  const isProjectMember = unitResult.ok
    ? await resolveIsProjectMember(unitResult.data.projectId, currentUser.id, currentUser.roleName)
    : false;

  // policyAssignment now includes organizationId sourced directly from the
  // handler query — no extra project lookup needed here.
  if (!ChapterAssignmentPolicy.edit(policyUser, assignmentResult.data, isProjectMember)) {
    return c.json(
      { message: 'Forbidden: You do not have permission to edit this verse right now.' },
      HttpStatusCodes.FORBIDDEN
    );
  }

  const result = await translatedVersesHandler.upsertTranslatedVerse(translatedVerseData);
  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
});

// ─── GET /translated-verses ───────────────────────────────────────────────────

const listTranslatedVersesRoute = createRoute({
  tags: ['Translated Verses'],
  method: 'get',
  path: '/translated-verses',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
  request: {
    query: z.object({
      projectUnitId: z.coerce
        .number()
        .int()
        .openapi({
          param: { name: 'projectUnitId', in: 'query', required: true },
          description: 'Filter by project unit ID (Required for authorization)',
          example: 24,
        }),
      bookId: z.coerce
        .number()
        .int()
        .optional()
        .openapi({
          param: { name: 'bookId', in: 'query', required: false },
          description: 'Filter by book ID',
          example: 1,
        }),
      chapterNumber: z.coerce
        .number()
        .int()
        .optional()
        .openapi({
          param: { name: 'chapterNumber', in: 'query', required: false },
          description: 'Filter by chapter number',
          example: 1,
        }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectTranslatedVersesSchema.array().openapi('TranslatedVerses'),
      'The list of translated verses (optionally filtered)'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
      'Project not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Unauthorized'),
      'Authentication required'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('Forbidden'),
      'Access denied'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
      'Internal server error'
    ),
  },
  summary: 'List translated verses',
  description: 'Returns a list of translated verses. projectUnitId is required for authorization.',
});

server.openapi(listTranslatedVersesRoute, async (c) => {
  const { projectUnitId, bookId, chapterNumber } = c.req.valid('query');
  const currentUser = c.get('user')!;
  const policyUser = {
    id: currentUser.id,
    role: currentUser.role,
    roleName: currentUser.roleName,
    organization: currentUser.organization,
  };

  const unitResult = await getProjectIdByUnitId(projectUnitId);
  if (!unitResult.ok) {
    return c.json({ message: unitResult.error.message }, HttpStatusCodes.NOT_FOUND);
  }

  const projectResult = await projectHandler.getProjectById(unitResult.data.projectId);
  if (!projectResult.ok) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const isProjectMember = await resolveIsProjectMember(
    unitResult.data.projectId,
    currentUser.id,
    currentUser.roleName
  );

  if (!ProjectPolicy.read(policyUser, projectResult.data, isProjectMember)) {
    return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);
  }

  const result = await translatedVersesHandler.listTranslatedVerses({
    projectUnitId,
    bookId,
    chapterNumber,
  });
  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
});
