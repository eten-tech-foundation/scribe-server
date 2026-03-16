import { z } from '@hono/zod-openapi';

export const bibleTextResponseSchema = z.object({
  id: z.number().int(),
  chapterNumber: z.number().int(),
  verseNumber: z.number().int(),
  text: z.string(),
});

export type BibleTextResponse = z.infer<typeof bibleTextResponseSchema>;
