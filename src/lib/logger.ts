import appInsights from 'applicationinsights';
import pino from 'pino';
import env from '@/env';

// Locally defined SeverityLevel enum matching Application Insights
enum SeverityLevel {
  Verbose = 0,
  Information = 1,
  Warning = 2,
  Error = 3,
  Critical = 4
}

let logger: any;

if (env.NODE_ENV === 'production') {
  const connectionString = env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (connectionString) {
    appInsights.setup(connectionString).start();
  } else {
    console.warn('Application Insights connection string not set. Telemetry will not be sent.');
  }
  const client = appInsights.defaultClient;
  class Logger {
    info(message: string, properties?: Record<string, any>) {
      if (client) client.trackTrace({ message, severity: SeverityLevel.Information as any, properties });
      console.info(message);
    }
    warn(message: string, properties?: Record<string, any>) {
      if (client) client.trackTrace({ message, severity: SeverityLevel.Warning as any, properties });
      console.warn(message);
    }
    error(message: string | Error, properties?: Record<string, any>) {
      if (client) {
        if (message instanceof Error) {
          client.trackException({ exception: message, properties });
          console.error(message.stack || message.message);
        } else {
          client.trackTrace({ message, severity: SeverityLevel.Error as any, properties });
          console.error(message);
        }
      } else {
        console.error(message);
      }
    }
    debug(message: string, properties?: Record<string, any>) {
      if (client) client.trackTrace({ message, severity: SeverityLevel.Verbose as any, properties });
      console.debug(message);
    }
    trace(message: string, properties?: Record<string, any>) {
      if (client) client.trackTrace({ message, severity: SeverityLevel.Verbose as any, properties });
      console.trace(message);
    }
  }
  logger = new Logger();
} else {
  // Use Pino in development
  logger = pino({ level: 'debug', transport: { target: 'pino-pretty' } });
}


export { logger };
