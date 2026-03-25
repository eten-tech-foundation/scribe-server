import { z } from '@hono/zod-openapi';

import type {
  editorStateResourcesSchema,
  insertUserChapterAssignmentEditorStateSchema,
} from '@/db/schema';

// ─── DB-derived types ─────────────────────────────────────────────────────────

export type UpsertEditorStateInput = z.infer<typeof insertUserChapterAssignmentEditorStateSchema>;

export type EditorStateResources = z.infer<typeof editorStateResourcesSchema>;

// ─── API response schema ──────────────────────────────────────────────────────

export const editorStateResponseSchema = z
  .object({
    bookCode: z.string(),
    tabStatus: z.boolean(),
    verseNumber: z.number(),
    languageCode: z.string(),
    chapterNumber: z.number(),
    activeResource: z.string(),
  })
  .nullable();

export type EditorStateResponse = z.infer<typeof editorStateResponseSchema>;
