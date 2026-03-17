import type { z } from '@hono/zod-openapi';

import type {
  editorStateResourcesSchema,
  insertUserChapterAssignmentEditorStateSchema,
} from '@/db/schema';

// ─── DB-derived types ─────────────────────────────────────────────────────────

export type UpsertEditorStateInput = z.infer<typeof insertUserChapterAssignmentEditorStateSchema>;

// ─── API response schema ──────────────────────────────────────────────────────

// Re-export the schema from db so routes and services share one definition.
export type EditorStateResources = z.infer<typeof editorStateResourcesSchema>;
