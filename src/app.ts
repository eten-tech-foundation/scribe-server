import configureOpenAPI from '@/lib/configure-open-api';
import { server } from '@/server/server';
import '@/routes/index.route';
import '@/routes/health.route';
import '@/routes/protected.route';
import '@/domains/users/users.route';
import '@/domains/projects/projects.route';
import '@/domains/languages/languages.routes';

configureOpenAPI(server);

export default server;
