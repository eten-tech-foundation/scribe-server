import { serve } from '@hono/node-server';
import { DistributedTracingModes, setup } from 'applicationinsights';

import app from './app';

import env from './env';

setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setInternalLogging(true, true)
  .setAutoDependencyCorrelation(true)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true, true)
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true)
  .setAutoCollectConsole(true)
  .setUseDiskRetryCaching(true)
  .setSendLiveMetrics(true)
  .start();

const port = env.PORT;
// eslint-disable-next-line no-console
console.log(`Server is running on port http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
