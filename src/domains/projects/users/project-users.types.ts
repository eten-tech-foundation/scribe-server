import { z } from '@hono/zod-openapi';

import type { insertProjectUserRolesSchema, selectProjectUserRolesSchema } from '@/db/schema';

// ─── DB-derived types ─────────────────────────────────────────────────────────

export type ProjectUserRole = z.infer<typeof selectProjectUserRolesSchema>;
export type CreateProjectUserRoleInput = z.infer<typeof insertProjectUserRolesSchema>;

// ─── API response schema ──────────────────────────────────────────────────────

export const projectUserRoleResponseSchema = z.object({
  projectId: z.number().int(),
  userId: z.number().int(),
  projectRole: z.enum(['project_manager', 'translator', 'peer_checker', 'observer']),
  displayName: z.string(),
  createdAt: z.date().nullable(),
});

export type ProjectUserRoleResponse = z.infer<typeof projectUserRoleResponseSchema>;

export const addProjectUserRoleRequestSchema = z.object({
  userIds: z.array(z.number().int()).min(1),
  projectRole: z.enum(['project_manager', 'translator', 'peer_checker', 'observer']),
});

export const projectIdParamSchema = z.object({
  projectId: z.coerce
    .number()
    .int()
    .positive()
    .openapi({
      param: { name: 'projectId', in: 'path', required: true },
    }),
});

export const removeProjectUserParamSchema = z.object({
  projectId: z.coerce
    .number()
    .int()
    .positive()
    .openapi({
      param: { name: 'projectId', in: 'path', required: true },
    }),
  userId: z.coerce
    .number()
    .int()
    .positive()
    .openapi({
      param: { name: 'userId', in: 'path', required: true },
    }),
});
