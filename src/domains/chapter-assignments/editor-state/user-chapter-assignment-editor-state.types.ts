import { z } from '@hono/zod-openapi';

import type {
  editorStateResourcesSchema,
  insertUserChapterAssignmentEditorStateSchema,
} from '@/db/schema';

// ─── DB-derived types ─────────────────────────────────────────────────────────

export type UpsertEditorStateInput = z.infer<typeof insertUserChapterAssignmentEditorStateSchema>;

export type EditorStateResources = z.infer<typeof editorStateResourcesSchema>;

// ─── API response schema ──────────────────────────────────────────────────────

export const editorStateResponseSchema = z.object({
  resources: z.record(z.unknown()).nullable(),
});

export type EditorStateResponse = z.infer<typeof editorStateResponseSchema>;
