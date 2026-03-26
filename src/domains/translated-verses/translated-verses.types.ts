import { z } from '@hono/zod-openapi';

import type {
  insertTranslatedVersesSchema,
  patchTranslatedVersesSchema,
  selectTranslatedVersesSchema,
} from '@/db/schema';

// Internal types
export type TranslatedVerseRecord = z.infer<typeof selectTranslatedVersesSchema> & {
  verseNumber: number;
};

export type CreateTranslatedVerseInput = z.infer<typeof insertTranslatedVersesSchema>;
export type UpdateTranslatedVerseInput = z.infer<typeof patchTranslatedVersesSchema>;

export interface TranslatedVersesFilters {
  projectUnitId?: number;
  bookId?: number;
  chapterNumber?: number;
}

// Explicit API response schemas
export const translatedVerseResponseSchema = z.object({
  id: z.number().int(),
  projectUnitId: z.number().int(),
  bibleTextId: z.number().int(),
  assignedUserId: z.number().int().nullable(),
  content: z.string(),
  verseNumber: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TranslatedVerseResponse = z.infer<typeof translatedVerseResponseSchema>;
