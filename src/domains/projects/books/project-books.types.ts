import { z } from '@hono/zod-openapi';

export const projectBookSchema = z.object({
  bookId: z.number().int(),
  code: z.string(),
  engDisplayName: z.string(),
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

// Domain types inferred from Zod

export type ProjectBook = z.infer<typeof projectBookSchema>;
