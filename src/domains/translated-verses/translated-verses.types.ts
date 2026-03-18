import { z } from '@hono/zod-openapi';

import type { insertTranslatedVersesSchema, patchTranslatedVersesSchema } from '@/db/schema';

import { selectTranslatedVersesSchema } from '@/db/schema';

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
export const translatedVerseResponseSchema = selectTranslatedVersesSchema.extend({
  verseNumber: z.number(),
});

export type TranslatedVerseResponse = z.infer<typeof translatedVerseResponseSchema>;
