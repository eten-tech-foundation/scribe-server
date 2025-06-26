import { pino } from 'pino';

import env from '@/env';

const isDev = env.NODE_ENV === 'development' || env.NODE_ENV === 'dev';

export const logger = isDev
  ? pino({
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    })
  : pino({
      level: 'info',
    });
