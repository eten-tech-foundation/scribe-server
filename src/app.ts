import 'reflect-metadata';

import { IocContainer } from '@/ioc/container';
import configureOpenAPI from '@/lib/configure-open-api';
import { Server } from '@/server/server';

import '@/routes/index.route';
import '@/routes/health.route';

const container = IocContainer.container;

const server = container.get(Server);

configureOpenAPI(server.hono);

export default server.hono;
