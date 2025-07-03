import { pinoLogger as honoPinoLogger } from 'hono-pino';
import { logger } from '@/lib/logger';

export function pinoLogger() {
  return honoPinoLogger({
    pino: logger,
  });
}
