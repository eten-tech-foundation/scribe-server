import configureOpenAPI from '@/lib/configure-open-api';
import { server } from '@/server/server';
import '@/routes/index.route';
import '@/routes/health.route';
import '@/routes/protected.route';
import '@/routes/users.route';

configureOpenAPI(server);

export default server;
