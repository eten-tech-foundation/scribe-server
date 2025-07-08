import { pino } from 'pino';
import { createLogger } from '@shellicar/pino-applicationinsights-transport';
import {
  TelemetryClient,
  setup,
  defaultClient,
  DistributedTracingModes,
} from 'applicationinsights';

import env from '@/env';

// Option 2: Using setup and defaultClient

// const client = new TelemetryClient(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING);
export const logger = createLogger({
  console: true, // Enable console logging
  insights: {
    client: defaultClient,
    version: 3, // Specify the version: 2 or 3
  },
  pino: {
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  },
});

const isDev = env.NODE_ENV === 'development' || env.NODE_ENV === 'dev';

// export const ogLogger = isDev
//   ? pino({
//       level: 'debug',
//       transport: {
//         target: 'pino-pretty',
//         options: {
//           colorize: true,
//           translateTime: 'SYS:standard',
//           ignore: 'pid,hostname',
//         },
//       },
//     })
//   : pino({
//       level: 'info',
//     });
