import type { z } from '@hono/zod-openapi';

import type { selectBibleBooksSchema } from '@/db/schema';

export type BibleBook = z.infer<typeof selectBibleBooksSchema>;

export interface BibleBookWithDetails extends BibleBook {
  book: {
    id: number;
    code: string;
    eng_display_name: string;
  };
  bible: {
    id: number;
    name: string;
  };
}

export interface CreateBibleBookInput {
  bibleId: number;
  bookId: number;
}

export interface UpdateBibleBookInput {
  bibleId: number;
  bookId: number;
  updatedAt?: Date;
}
