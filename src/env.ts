import { z } from '@hono/zod-openapi';
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import path from 'node:path';

expand(
  config({
    path: path.resolve(process.cwd(), process.env.NODE_ENV === 'test' ? '.env.test' : '.env'),
  })
);

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info')
    .optional(),
  DATABASE_URL: z.string().url(),
  AUTH0_DOMAIN: z.string(),
  AUTH0_AUDIENCE: z.string(),
  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string(),
  AUTH0_M2M_CLIENT_ID: z.string(),
  AUTH0_M2M_CLIENT_SECRET: z.string(),
  EMAIL_SERVICE_API_KEY: z.string(),
  EMAIL_SERVICE_DOMAIN: z.string(),
  FRONTEND_URL: z.string(),
});

export type env = z.infer<typeof EnvSchema>;

// eslint-disable-next-line ts/no-redeclare
const { data: env, error } = EnvSchema.safeParse(process.env);

if (error) {
  console.error('❌ Invalid env:');
  console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export default env!;
