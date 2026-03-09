import type { z } from '@hono/zod-openapi';

import type { selectBooksSchema } from '@/db/schema';

export type Book = z.infer<typeof selectBooksSchema>;

export interface BookResponse {
  id: number;
  code: string;
  eng_display_name: string;
}
