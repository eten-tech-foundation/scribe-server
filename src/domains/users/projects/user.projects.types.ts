import { z } from '@hono/zod-openapi';

import { chapterStatusEnum } from '@/db/schema';

// ─── DB-derived types ─────────────────────────────────────────────────────────
export type ChapterStatusCounts = Record<string, number>;

export interface WorkflowStep {
  id: string;
  label: string;
}

export interface ProjectWithLanguageNames {
  id: number;
  name: string;
  organization: number;
  isActive: boolean | null;
  status: 'active' | 'not_assigned';
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  metadata: unknown;
  sourceLanguageName: string;
  targetLanguageName: string;
  sourceName: string;
  lastChapterActivity: Date | null;
  chapterStatusCounts: ChapterStatusCounts;
  workflowConfig: WorkflowStep[];
}

// Raw DB row returned by the repository query before mapping
export interface RawProjectRow {
  counts: Record<string, number> | null;
  id: number;
  name: string;
  organization: number;
  isActive: boolean | null;
  status: 'active' | 'not_assigned';
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  metadata: unknown;
  sourceLanguageName: string;
  targetLanguageName: string;
  sourceName: string;
  lastChapterActivity: Date | null;
}

// ─── API response schema ──────────────────────────────────────────────────────
const chapterStatusCountsSchema = z.object(
  chapterStatusEnum.enumValues.reduce(
    (acc, status) => {
      acc[status] = z.number().int().min(0);
      return acc;
    },
    {} as Record<string, z.ZodNumber>
  )
);

const workflowStepSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const userProjectResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  organization: z.number().int(),
  isActive: z.boolean().nullable(),
  status: z.enum(['active', 'not_assigned']),
  createdBy: z.number().int().nullable(),
  createdAt: z.union([z.date(), z.string()]).nullable(),
  updatedAt: z.union([z.date(), z.string()]).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  sourceLanguageName: z.string(),
  targetLanguageName: z.string(),
  sourceName: z.string(),
  lastChapterActivity: z.union([z.date(), z.string()]).nullable(),
  chapterStatusCounts: chapterStatusCountsSchema,
  workflowConfig: z.array(workflowStepSchema),
});

export type UserProjectResponse = z.infer<typeof userProjectResponseSchema>;
