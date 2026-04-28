import { z } from '@hono/zod-openapi';

import type { selectLanguageBcpCodesSchema } from '@/db/schema';

export type LanguageBcpCode = z.infer<typeof selectLanguageBcpCodesSchema>;

export const bcpLookupResponseSchema = z.object({
  id: z.number(),
  languageName: z.string(),
  bcp47Code: z.string().nullable(),
  iso6393Code: z.string().nullable(),
  iso6391Code: z.string().nullable(),
});

export type BcpLookupResponse = z.infer<typeof bcpLookupResponseSchema>;

export const bcpLookupQuerySchema = z
  .object({
    language: z
      .string()
      .optional()
      .openapi({
        param: { name: 'language', in: 'query' },
        example: 'Hindi,Tamil',
        description:
          'Comma-separated language names (partial, case-insensitive). ' +
          'E.g. `?language=Hindi,Tamil`',
      }),
    iso: z
      .string()
      .optional()
      .openapi({
        param: { name: 'iso', in: 'query' },
        example: 'hin,tam',
        description:
          'Comma-separated ISO 639-3 or ISO 639-1 codes (exact match). ' +
          'E.g. `?iso=hin,tam`. Can be combined with `language`.',
      }),
  })
  .refine((q) => q.language || q.iso, {
    message: 'At least one of `language` or `iso` must be provided',
  });

export type BcpLookupQuery = z.infer<typeof bcpLookupQuerySchema>;
