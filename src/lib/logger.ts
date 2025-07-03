import { createLogger } from '@shellicar/pino-applicationinsights-transport';
import { TelemetryClient, setup } from 'applicationinsights';
import env from '@/env';

const isDev = env.NODE_ENV === 'development' || env.NODE_ENV === 'dev';

setup(env.APPLICATIONINSIGHTS_CONNECTION_STRING).start();
const client = new TelemetryClient(env.APPLICATIONINSIGHTS_CONNECTION_STRING);

export const logger = createLogger({
  console: isDev,
  pino: isDev
    ? {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        level: 'info',
      },
  insights: {
    version: 2,
    client: client,
  },
});
