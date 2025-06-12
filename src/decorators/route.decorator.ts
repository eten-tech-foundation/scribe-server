import type { Context } from 'hono';

import { createRoute } from '@hono/zod-openapi';

import { IocContainer } from '../ioc/container';
import { Server } from '../server/server';

enum RequestMethod {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
  PATCH = 'patch',
  DELETE = 'delete',
}

interface RouteParameters {
  path: string;
  tags?: string[];
  request?: any;
  responses: any;
  security?: any[];
}

interface PendingRoute {
  method: RequestMethod;
  routeParameters: RouteParameters;
  target: any;
  propertyKey: string;
}

const BASE_ROUTE_METADATA = Symbol.for('baseRoute');

const baseRoutes = new Map<any, string>();

const pendingRoutes: PendingRoute[] = [];

export function baseRoute(basePath: string) {
  return (target: any) => {
    baseRoutes.set(target, basePath);
    Reflect.defineMetadata(BASE_ROUTE_METADATA, basePath, target);
  };
}

function createMethodDecorator(type: RequestMethod) {
  return (routeParameters: RouteParameters) => {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      pendingRoutes.push({
        method: type,
        routeParameters,
        target,
        propertyKey,
      });

      return descriptor;
    };
  };
}

export function registerPendingRoutes(): void {
  const server = IocContainer.container.get<Server>(Server);

  for (const pendingRoute of pendingRoutes) {
    const basePath = baseRoutes.get(pendingRoute.target.constructor) || '';
    let fullPath: string;

    if (basePath) {
      const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
      const routePath = pendingRoute.routeParameters.path;

      if (routePath === '/') {
        fullPath = cleanBasePath;
      } else if (routePath.startsWith('/')) {
        fullPath = cleanBasePath + routePath;
      } else {
        fullPath = cleanBasePath + '/' + routePath;
      }
    } else {
      fullPath = pendingRoute.routeParameters.path;
    }

    const route = createRoute({
      method: pendingRoute.method,
      path: fullPath,
      tags: pendingRoute.routeParameters.tags,
      request: pendingRoute.routeParameters.request,
      responses: pendingRoute.routeParameters.responses,
      security: pendingRoute.routeParameters.security,
    });

    server.hono.openapi(route, async (ctx: Context) => {
      const controller = IocContainer.container.get(pendingRoute.target.constructor) as any;
      return await controller[pendingRoute.propertyKey](ctx);
    });
  }
  pendingRoutes.length = 0;
}

export const Get = createMethodDecorator(RequestMethod.GET);
export const Post = createMethodDecorator(RequestMethod.POST);
export const Put = createMethodDecorator(RequestMethod.PUT);
export const Patch = createMethodDecorator(RequestMethod.PATCH);
export const Delete = createMethodDecorator(RequestMethod.DELETE);
