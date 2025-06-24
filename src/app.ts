import 'reflect-metadata';

import { IocContainer } from '@/ioc/container';
import configureOpenAPI from '@/lib/configure-open-api';
import { Server } from '@/server/server';
import { auth0Middleware } from '@/middlewares/auth0';

import '@/routes/index.route';
import '@/routes/health.route';

const container = IocContainer.container;

const server = container.get(Server);

// Apply Auth0 middleware only to protected routes
server.hono.use('/api/protected', auth0Middleware);

configureOpenAPI(server.hono);

export default server.hono;
