import { z } from '@hono/zod-openapi';

// ─── API response schema ──────────────────────────────────────────────────────

export const presenceResponseSchema = z.object({
  isFirstEditor: z.boolean().openapi({
    description: 'Is the current user the first one editing?',
  }),
  firstEditorName: z.string().nullable().openapi({
    description: 'Display name of the first editor if current user is not first',
  }),
});

export type PresenceResponse = z.infer<typeof presenceResponseSchema>;
