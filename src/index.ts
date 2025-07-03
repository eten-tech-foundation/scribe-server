// Import the `useAzureMonitor()` function from the `@azure/monitor-opentelemetry` package.
// import { useAzureMonitor, AzureMonitorOpenTelemetryOptions } from '@azure/monitor-opentelemetry';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

// Initialize the logger
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL);

// const options: AzureMonitorOpenTelemetryOptions = {};
// // Call the `useAzureMonitor()` function to configure OpenTelemetry to use Azure Monitor.
// useAzureMonitor(options);

import { serve } from '@hono/node-server';

import app from './app';

import env from './env';

const port = env.PORT;
// eslint-disable-next-line no-console
console.log(`Server is running on port http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
