import configureOpenAPI from '@/lib/configure-open-api';
import { server } from '@/server/server';

import '@/routes/index.route';
import '@/routes/health.route';
import '@/domains/tasks/task.route';
import '@/domains/users/user.route';
import '@/routes/protected.route';

configureOpenAPI(server);

export default server;
