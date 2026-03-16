import { z } from '@hono/zod-openapi';

// ─── API response types ────────────────────────────────────────────────────────

export interface BibleTextResponse {
  id: number;
  chapterNumber: number;
  verseNumber: number;
  text: string;
}

export const bibleTextResponseSchema = z.object({
  id: z.number().int(),
  chapterNumber: z.number().int(),
  verseNumber: z.number().int(),
  text: z.string(),
});
