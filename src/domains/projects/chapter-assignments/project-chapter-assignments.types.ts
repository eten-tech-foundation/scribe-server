import { z } from '@hono/zod-openapi';

export const userResponseSchema = z.object({
  id: z.number().int(),
  displayName: z.string(),
});

export const chapterAssignmentResponseSchema = z.object({
  id: z.number().int().optional(),
  projectUnitId: z.number().int(),
  bibleId: z.number().int(),
  bookId: z.number().int(),
  chapterNumber: z.number().int(),
  assignedUserId: z.number().int().nullable().optional(),
  submittedTime: z.date().nullable().optional(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
});

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

export type AssignmentUser = z.infer<typeof userResponseSchema>;
export type ChapterAssignmentResponse = z.infer<typeof chapterAssignmentResponseSchema>;
export type ChapterAssignmentProgress = z.infer<typeof chapterAssignmentProgressResponseSchema>;
