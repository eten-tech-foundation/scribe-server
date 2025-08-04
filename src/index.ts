import 'dotenv/config';
import { serve } from '@hono/node-server';

import env from '@/env';

import app from './app';

// eslint-disable-next-line no-console
console.log(`Server is running on port http://localhost:${env.PORT}`);

serve({
  fetch: app.fetch,
  port: env.PORT,
});
