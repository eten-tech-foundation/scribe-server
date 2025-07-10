import { logger } from '@/lib/logger';

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000,
  backoffFactor: 2,
};

// Retryable error patterns (strings or RegExp)
const RETRYABLE_ERROR_PATTERNS: (string | RegExp)[] = [
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  /connection terminated/i,
  /server closed the connection/i,
];

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if an error is retryable
function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  const isTaggedRetryable = (error as any)?.retryable === true;

  if (isTaggedRetryable) return true;

  return RETRYABLE_ERROR_PATTERNS.some(pattern => {
    if (typeof pattern === 'string') {
      return message.includes(pattern) || code === pattern;
    } else {
      return pattern.test(message);
    }
  });
}

// Retry wrapper
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.maxRetries || !isRetryableError(error)) {
        throw lastError;
      }

      const delay = Math.min(
        opts.baseDelay * Math.pow(opts.backoffFactor, attempt - 1),
        opts.maxDelay
      );

      logger.warn('Retrying database operation due to error', {
        attempt,
        maxRetries: opts.maxRetries,
        delay,
        error: lastError.message,
      });

      await sleep(delay);
    }
  }

  throw lastError!;
}
