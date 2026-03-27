import { z } from '@hono/zod-openapi';

import { chapterAssignmentResponseSchema as sharedAssignmentSchema } from '@/domains/chapter-assignments/chapter-assignments.types';

export const userResponseSchema = z.object({
  id: z.number().int(),
  displayName: z.string(),
});

export const chapterAssignmentResponseSchema = sharedAssignmentSchema;

export const chapterAssignmentProgressResponseSchema = z.object({
  assignmentId: z.number(),
  projectUnitId: z.number(),
  bibleId: z.number(),
  bookId: z.number(),
  bookCode: z.string(),
  sourceLangCode: z.string(),
  status: z.string(),
  bookNameEng: z.string(),
  chapterNumber: z.number(),
  assignedUser: z.nullable(userResponseSchema),
  peerChecker: z.nullable(userResponseSchema),
  totalVerses: z.number().int(),
  completedVerses: z.number().int(),
  submittedTime: z.date().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export const assignUserInputSchema = z
  .object({
    assignedUserId: z.number().int().optional(),
    peerCheckerId: z.number().int().optional(),
  })
  .refine((data) => data.assignedUserId !== undefined || data.peerCheckerId !== undefined, {
    message: 'At least one of assignedUserId or peerCheckerId must be provided',
  });

export type AssignmentUser = z.infer<typeof userResponseSchema>;
export type ChapterAssignmentResponse = z.infer<typeof chapterAssignmentResponseSchema>;
export type ChapterAssignmentProgress = z.infer<typeof chapterAssignmentProgressResponseSchema>;
export type AssignUserInput = z.infer<typeof assignUserInputSchema>;
