import type { z } from '@hono/zod-openapi';

import { and, eq, sql } from 'drizzle-orm';

import type {
  editorStateResourcesSchema,
  insertUserChapterAssignmentEditorStateSchema,
} from '@/db/schema';
import type { Result } from '@/lib/types';

import { db } from '@/db';
import { user_chapter_assignment_editor_state } from '@/db/schema';
import { logger } from '@/lib/logger';

export type UpsertUserChapterAssignmentEditorStateInput = z.infer<
  typeof insertUserChapterAssignmentEditorStateSchema
>;

export async function getEditorState(
  userId: number,
  chapterAssignmentId: number
): Promise<Result<z.infer<typeof editorStateResourcesSchema>>> {
  try {
    const [result] = await db
      .select({ resources: user_chapter_assignment_editor_state.resources })
      .from(user_chapter_assignment_editor_state)
      .where(
        and(
          eq(user_chapter_assignment_editor_state.userId, userId),
          eq(user_chapter_assignment_editor_state.chapterAssignmentId, chapterAssignmentId)
        )
      )
      .limit(1);

    return { ok: true, data: result?.resources ?? null };
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to fetch editor state',
      context: { userId, chapterAssignmentId },
    });
    return { ok: false, error: { message: 'Failed to fetch editor state' } };
  }
}

export async function upsertEditorState(
  input: UpsertUserChapterAssignmentEditorStateInput
): Promise<Result<z.infer<typeof editorStateResourcesSchema>>> {
  try {
    const [result] = await db
      .insert(user_chapter_assignment_editor_state)
      .values(input)
      .onConflictDoUpdate({
        target: [
          user_chapter_assignment_editor_state.userId,
          user_chapter_assignment_editor_state.chapterAssignmentId,
        ],
        set: {
          resources: sql`excluded.resources`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ resources: user_chapter_assignment_editor_state.resources });

    return { ok: true, data: result.resources };
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to upsert editor state',
      context: input,
    });
    return { ok: false, error: { message: 'Failed to save editor state' } };
  }
}
