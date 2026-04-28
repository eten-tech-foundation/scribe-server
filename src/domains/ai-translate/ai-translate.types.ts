import { z } from '@hono/zod-openapi';

// ─── Request body sent by the UI ─────────────────────────────────────────────

export const translateRequestSchema = z.object({
  sourceLanguage: z
    .string()
    .min(1)
    .openapi({
      example: 'Gujarati',
      description:
        'Source language name OR ISO 639-3 / ISO 639-1 code. ' +
        'Used to look up the BCP-47 code for the Vachan API.',
    }),
  targetLanguage: z
    .string()
    .min(1)
    .openapi({
      example: 'Koli Kachchi',
      description:
        'Target language name OR ISO 639-3 / ISO 639-1 code. ' +
        'Used to look up the BCP-47 code for the Vachan API.',
    }),
  verses: z
    .array(z.string().min(1))
    .min(1)
    .openapi({
      example: ['In the beginning God created the heavens and the earth.'],
      description: 'One or more verse strings to translate.',
    }),
  modelName: z
    .string()
    .optional()
    .openapi({
      example: 'nllb-600M',
      description:
        'Override the Vachan model name. Defaults to `nllb-600M` for known languages, ' +
        'or `nllb-{target-language-slug}` when the target has no standard BCP-47 code.',
    }),
  device: z.enum(['cpu', 'gpu']).default('cpu').openapi({
    example: 'cpu',
    description: 'Compute device for the Vachan API.',
  }),
});

export type TranslateRequest = z.infer<typeof translateRequestSchema>;

// ─── Vachan API shapes (external) ────────────────────────────────────────────

export interface VachanTranslateResponse {
  message: string;
  data: {
    jobId: number;
    status: string;
  };
}

export interface VachanJobResponse {
  message: string;
  data: {
    creationTime: string;
    jobId: number;
    output: {
      data: string[] | Record<string, unknown>[];
    };
    status: string;
    updationTime: string;
    userId: string;
  };
}

// ─── Responses returned by our API ───────────────────────────────────────────

export const translateResponseSchema = z.object({
  jobId: z.number(),
  status: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  sourceBcp47: z.string().nullable(),
  targetBcp47: z.string().nullable(),
  modelName: z.string(),
  verseCount: z.number(),
  output: z.array(z.string()),
});

export type TranslateResponse = z.infer<typeof translateResponseSchema>;

export const jobStatusResponseSchema = z.object({
  jobId: z.number(),
  status: z.string(),
  creationTime: z.string(),
  updationTime: z.string(),
  output: z.array(z.string()),
});

export type JobStatusResponse = z.infer<typeof jobStatusResponseSchema>;
