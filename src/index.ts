import 'dotenv/config';
import { serve } from '@hono/node-server';

import app from './app';

const port = parseInt(process.env.PORT || '9999');
// eslint-disable-next-line no-console
console.log(`Server is running on port http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
