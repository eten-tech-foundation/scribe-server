import { z } from '@hono/zod-openapi';

import type { selectChapterAssignmentsSchema } from '@/db/schema';

// ─── DB-derived types ─────────────────────────────────────────────────────────

export type ChapterAssignmentStatus = 'not_started' | 'draft' | 'peer_check' | 'community_review';

export type ChapterAssignmentRecord = z.infer<typeof selectChapterAssignmentsSchema>;

export interface ChapterAssignmentRecordWithOrg extends ChapterAssignmentRecord {
  organizationId: number;
}

// ─── Service input types ──────────────────────────────────────────────────────

export interface CreateChapterAssignmentRequestData {
  projectUnitId: number;
  bibleId: number;
  bookId: number;
  chapterNumber: number;
  assignedUserId?: number;
  peerCheckerId?: number;
}

export interface UpdateChapterAssignmentRequestData {
  assignedUserId?: number;
  peerCheckerId?: number;
  status?: ChapterAssignmentStatus;
  submittedTime?: Date;
}

// ─── API response schema ──────────────────────────────────────────────────────

export const chapterAssignmentResponseSchema = z.object({
  id: z.number().int(),
  projectUnitId: z.number().int(),
  bibleId: z.number().int(),
  bookId: z.number().int(),
  chapterNumber: z.number().int(),
  assignedUserId: z.number().int().nullable().optional(),
  peerCheckerId: z.number().int().nullable().optional(),
  status: z.enum(['not_started', 'draft', 'peer_check', 'community_review']).optional(),
  submittedTime: z.date().nullable().optional(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export type ChapterAssignmentResponse = z.infer<typeof chapterAssignmentResponseSchema>;
