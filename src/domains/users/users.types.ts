import { z } from '@hono/zod-openapi';

import type { insertUsersSchema, patchUsersSchema, selectUsersSchema } from '@/db/schema';

// ─── DB-derived types ─────────────────────────────────────────────────────────
export type User = z.infer<typeof selectUsersSchema>;
export type CreateUserInput = z.infer<typeof insertUsersSchema>;
export type UpdateUserInput = z.infer<typeof patchUsersSchema>;

// ─── API response schema ──────────────────────────────────────────────────────
export const userResponseSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
  username: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: z.number().int(),
  organization: z.number().int(),
  createdBy: z.number().int().nullable(),
  status: z.enum(['invited', 'verified', 'inactive']),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
