import type { Result } from '@/lib/types';

import { err, ErrorCode } from '@/lib/types';

/**
 * Maps Postgres unique-constraint violations (code 23505) to typed domain errors.
 * Falls back to the provided fallback error code for all other failures.
 */
export function handleUniqueConstraintError(
  error: unknown,
  fallback: ErrorCode = ErrorCode.INTERNAL_ERROR
): Result<never> {
  if (error && typeof error === 'object' && 'cause' in error) {
    const cause = (error as { cause?: { code?: string; constraint_name?: string } }).cause;
    if (cause?.code === '23505') {
      const constraint = cause.constraint_name ?? '';
      if (constraint.includes('username')) return err(ErrorCode.USERNAME_CONFLICT);
      if (constraint.includes('email')) return err(ErrorCode.EMAIL_CONFLICT);
      return err(ErrorCode.DUPLICATE);
    }
  }
  return err(fallback);
}
