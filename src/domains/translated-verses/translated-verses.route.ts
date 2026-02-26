import { createRoute, z } from '@hono/zod-openapi';
import { and, eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { db } from '@/db';
import {
  bible_texts,
  chapter_assignments,
  insertTranslatedVersesSchema,
  project_units,
  project_users,
  selectTranslatedVersesSchema,
} from '@/db/schema';
import { ChapterAssignmentPolicy } from '@/domains/chapter-assignments/chapter-assignments.policy';
import { ProjectPolicy } from '@/domains/projects/project.policy';
import * as projectHandler from '@/domains/projects/projects.handlers';
import { PERMISSIONS } from '@/lib/permissions';
import { ROLES } from '@/lib/roles';
import { authenticateUser, requirePermission } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as translatedVersesHandler from './translated-verses.handlers';

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

  const result = await translatedVersesHandler.getTranslatedVerseById(id);

  if (!result.ok) {
    if (result.error.message === 'Translated verse not found') {
      return c.json({ message: result.error.message }, HttpStatusCodes.NOT_FOUND);
    }
    return c.json({ message: result.error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  // Authorize using ProjectPolicy.read
  const [projectUnit] = await db
    .select({ projectId: project_units.projectId })
    .from(project_units)
    .where(eq(project_units.id, result.data.projectUnitId))
    .limit(1);

  if (!projectUnit) {
    return c.json({ message: 'Translated verse not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const projectResult = await projectHandler.getProjectById(projectUnit.projectId);
  if (!projectResult.ok) {
    return c.json({ message: 'Translated verse not found' }, HttpStatusCodes.NOT_FOUND);
  }

  let isAssignedToProject = false;
  if (currentUser.roleName === ROLES.TRANSLATOR) {
    const [member] = await db
      .select()
      .from(project_users)
      .where(
        and(
          eq(project_users.projectId, projectUnit.projectId),
          eq(project_users.userId, currentUser.id)
        )
      )
      .limit(1);
    isAssignedToProject = member !== undefined;
  }

  if (!ProjectPolicy.read(policyUser, projectResult.data, isAssignedToProject)) {
    return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);
  }

  return c.json(result.data, HttpStatusCodes.OK);
});

const upsertTranslatedVerseRoute = createRoute({
  tags: ['Translated Verses'],
  method: 'post',
  path: '/translated-verses',
  middleware: [authenticateUser, requirePermission(PERMISSIONS.PROJECT_VIEW)] as const,
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
            z.object({
              code: z.string(),
              path: z.array(z.string()),
              message: z.string(),
            })
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
  description:
    'Creates a new translated verse or updates existing one if it already exists for the same project unit and bible text',
});

server.openapi(upsertTranslatedVerseRoute, async (c) => {
  const translatedVerseData = c.req.valid('json');
  const currentUser = c.get('user')!;
  const policyUser = { id: currentUser.id, roleName: currentUser.roleName };

  if (!translatedVerseData.assignedUserId) {
    translatedVerseData.assignedUserId = currentUser.id;
  }

  // ─── Enforce ChapterAssignmentPolicy.edit ───
  const [bibleText] = await db
    .select({ bookId: bible_texts.bookId, chapterNumber: bible_texts.chapterNumber })
    .from(bible_texts)
    .where(eq(bible_texts.id, translatedVerseData.bibleTextId))
    .limit(1);

  if (!bibleText) {
    return c.json({ message: 'Invalid bibleTextId' }, HttpStatusCodes.BAD_REQUEST);
  }

  const [assignment] = await db
    .select({
      assignedUserId: chapter_assignments.assignedUserId,
      peerCheckerId: chapter_assignments.peerCheckerId,
      status: chapter_assignments.status,
    })
    .from(chapter_assignments)
    .where(
      and(
        eq(chapter_assignments.projectUnitId, translatedVerseData.projectUnitId),
        eq(chapter_assignments.bookId, bibleText.bookId),
        eq(chapter_assignments.chapterNumber, bibleText.chapterNumber)
      )
    )
    .limit(1);

  if (!assignment) {
    return c.json(
      { message: 'No chapter assignment found for this verse' },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const [projectUnit] = await db
    .select({ projectId: project_units.projectId })
    .from(project_units)
    .where(eq(project_units.id, translatedVerseData.projectUnitId))
    .limit(1);

  let isProjectMember = false;
  if (projectUnit) {
    const [member] = await db
      .select()
      .from(project_users)
      .where(
        and(
          eq(project_users.projectId, projectUnit.projectId),
          eq(project_users.userId, currentUser.id)
        )
      )
      .limit(1);
    isProjectMember = member !== undefined;
  }

  if (!ChapterAssignmentPolicy.edit(policyUser, assignment, isProjectMember)) {
    return c.json(
      { message: 'Forbidden: You do not have permission to edit this verse right now.' },
      HttpStatusCodes.FORBIDDEN
    );
  }
  // ────────────────────────────────────────────

  const result = await translatedVersesHandler.upsertTranslatedVerse(translatedVerseData);

  if (result.ok) {
    return c.json(result.data, HttpStatusCodes.OK);
  }

  return c.json({ message: result.error.message }, HttpStatusCodes.BAD_REQUEST);
});

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
      // <--- THIS WAS MISSING
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

  const [projectUnit] = await db
    .select({ projectId: project_units.projectId })
    .from(project_units)
    .where(eq(project_units.id, projectUnitId))
    .limit(1);

  if (!projectUnit) {
    return c.json({ message: 'Project unit not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const projectResult = await projectHandler.getProjectById(projectUnit.projectId);
  if (!projectResult.ok) {
    return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
  }

  let isAssignedToProject = false;
  if (currentUser.roleName === ROLES.TRANSLATOR) {
    const [member] = await db
      .select()
      .from(project_users)
      .where(
        and(
          eq(project_users.projectId, projectUnit.projectId),
          eq(project_users.userId, currentUser.id)
        )
      )
      .limit(1);
    isAssignedToProject = member !== undefined;
  }

  if (!ProjectPolicy.read(policyUser, projectResult.data, isAssignedToProject)) {
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
