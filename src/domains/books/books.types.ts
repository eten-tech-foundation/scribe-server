import { z } from '@hono/zod-openapi';

import type { selectBooksSchema } from '@/db/schema';

export type Book = z.infer<typeof selectBooksSchema>;

export const bookResponseSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  eng_display_name: z.string(),
});

export type BookResponse = z.infer<typeof bookResponseSchema>;
