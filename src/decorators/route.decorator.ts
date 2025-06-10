import type { Context } from "hono";

import { createRoute } from "@hono/zod-openapi";

import { IocContainer } from "../ioc/container";
import { Server } from "../server/server";

enum RequestMethod {
  GET = "get",
  POST = "post",
  PUT = "put",
  PATCH = "patch",
  DELETE = "delete",
}

interface RouteParameters {
  path: string;
  tags?: string[];
  request?: any;
  responses: any;
  security?: any[];
}

// Store route metadata for later registration
const ROUTE_METADATA_KEY = Symbol("routes");

function createMethodDecorator(type: RequestMethod) {
  return (routeParameters: RouteParameters) => {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const original = descriptor.value;

      // Store route metadata on the class
      if (!target.constructor[ROUTE_METADATA_KEY]) {
        target.constructor[ROUTE_METADATA_KEY] = [];
      }

      target.constructor[ROUTE_METADATA_KEY].push({
        method: type,
        ...routeParameters,
        handler: propertyKey,
        originalMethod: original,
      });

      // Return the original descriptor unchanged
      return descriptor;
    };
  };
}

// Helper function to register all routes for a controller
export function registerRoutes(controller: any) {
  const routes = controller.constructor[ROUTE_METADATA_KEY] || [];
  const server = IocContainer.container.get<Server>(Server);

  routes.forEach((routeConfig: any) => {
    const route = createRoute({
      method: routeConfig.method,
      path: routeConfig.path,
      tags: routeConfig.tags,
      request: routeConfig.request,
      responses: routeConfig.responses,
      security: routeConfig.security,
    });

    server.hono.openapi(route, async (ctx: Context) => {
      return await controller[routeConfig.handler](ctx);
    });
  });
}

export const Get = createMethodDecorator(RequestMethod.GET);
export const Post = createMethodDecorator(RequestMethod.POST);
export const Put = createMethodDecorator(RequestMethod.PUT);
export const Patch = createMethodDecorator(RequestMethod.PATCH);
export const Delete = createMethodDecorator(RequestMethod.DELETE);
