import { z } from '@hono/zod-openapi';

export const getAiSuggestionsQuerySchema = z.object({
  projectUnitId: z.coerce.number().int().positive(),
  bibleTextIds: z.string().describe('Comma-separated list of bible text IDs'),
});

export type GetAiSuggestionsQuery = z.infer<typeof getAiSuggestionsQuerySchema>;

export const aiSuggestionResponseSchema = z.object({
  bibleTextId: z.number().int(),
  suggestedText: z.string(),
  modelInfo: z.string().nullable().optional(),
});

export const aiSuggestionsListResponseSchema = z.object({
  data: z.array(aiSuggestionResponseSchema),
});

export type AiSuggestionsListResponse = z.infer<typeof aiSuggestionsListResponseSchema>;

export const queueNextVersesRequestSchema = z.object({
  projectUnitId: z.coerce.number().int().positive(),
  bibleId: z.coerce.number().int().positive(),
  bookCode: z.string().min(3).max(3),
  chapterNumber: z.coerce.number().int().positive(),
  currentVerse: z.coerce.number().int().nonnegative(),
  lookahead: z.coerce.number().int().positive().max(20).default(5),
});

export type QueueNextVersesRequest = z.infer<typeof queueNextVersesRequestSchema>;
