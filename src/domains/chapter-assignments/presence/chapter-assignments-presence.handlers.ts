import { and, asc, eq, lt } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { active_chapter_editors, users } from '@/db/schema';
import { STALE_THRESHOLD_MINUTES } from '@/lib/constants';
import { logger } from '@/lib/logger';

function resolveDisplayName(
  username: string,
  firstName: string | null,
  lastName: string | null
): string {
  const names = [firstName, lastName].filter((n): n is string => !!n && n.trim().length > 0);
  return names.length > 0 ? names.join(' ') : username;
}

export interface PresenceResult {
  isFirstEditor: boolean;
  firstEditorName: string | null;
}

export async function registerPresenceAndCheck(
  userId: number,
  chapterAssignmentId: number
): Promise<Result<PresenceResult>> {
  try {
    return await db.transaction(async (tx) => {
      const now = new Date();
      const staleTime = new Date(now.getTime() - STALE_THRESHOLD_MINUTES * 60 * 1000);

      await tx
        .delete(active_chapter_editors)
        .where(
          and(
            eq(active_chapter_editors.chapterAssignmentId, chapterAssignmentId),
            lt(active_chapter_editors.lastHeartbeat, staleTime)
          )
        );

      await tx
        .insert(active_chapter_editors)
        .values({
          userId,
          chapterAssignmentId,
          startedAt: now,
          lastHeartbeat: now,
        })
        .onConflictDoUpdate({
          target: [active_chapter_editors.chapterAssignmentId, active_chapter_editors.userId],
          set: {
            lastHeartbeat: now,
          },
        });

      const [firstEditor] = await tx
        .select({
          userId: active_chapter_editors.userId,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          startedAt: active_chapter_editors.startedAt,
        })
        .from(active_chapter_editors)
        .innerJoin(users, eq(active_chapter_editors.userId, users.id))
        .where(eq(active_chapter_editors.chapterAssignmentId, chapterAssignmentId))
        .orderBy(asc(active_chapter_editors.startedAt))
        .limit(1);

      if (!firstEditor) {
        throw new Error('No editor record found after upsert — this should not happen');
      }

      const isFirst = firstEditor.userId === userId;
      const displayName = resolveDisplayName(
        firstEditor.username,
        firstEditor.firstName,
        firstEditor.lastName
      );

      return {
        ok: true,
        data: {
          isFirstEditor: isFirst,
          firstEditorName: isFirst ? null : displayName,
        },
      };
    });
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to register presence',
      context: { userId, chapterAssignmentId },
    });
    return { ok: false, error: { message: 'Failed to sync presence' } };
  }
}

export async function removePresence(
  userId: number,
  chapterAssignmentId: number
): Promise<Result<null>> {
  try {
    await db
      .delete(active_chapter_editors)
      .where(
        and(
          eq(active_chapter_editors.userId, userId),
          eq(active_chapter_editors.chapterAssignmentId, chapterAssignmentId)
        )
      );

    return { ok: true, data: null };
  } catch (err) {
    logger.error({
      cause: err,
      message: 'Failed to remove presence',
      context: { userId, chapterAssignmentId },
    });
    return { ok: false, error: { message: 'Failed to remove presence' } };
  }
}
