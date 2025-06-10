import type { Context, MiddlewareHandler, Next } from "hono";

import { IocContainer } from "../ioc/container";
import { Server } from "../server/server";

const MIDDLEWARE_METADATA = Symbol("middleware");

interface PendingMiddleware {
  target: any;
  middleware: MiddlewareHandler;
  path?: string;
}

const pendingMiddlewares: PendingMiddleware[] = [];

export function middleware(middlewareHandler: MiddlewareHandler, path?: string) {
  return (target: any) => {
    pendingMiddlewares.push({
      target,
      middleware: middlewareHandler,
      path,
    });
    
    const existingMiddlewares = Reflect.getMetadata(MIDDLEWARE_METADATA, target) || [];
    Reflect.defineMetadata(MIDDLEWARE_METADATA, [{ middleware: middlewareHandler, path }, ...existingMiddlewares], target);
  };
}

export function registerPendingMiddlewares(): void {
  const server = IocContainer.container.get<Server>(Server);

  const middlewaresByTarget = new Map<any, PendingMiddleware[]>();
  
  for (const pendingMiddleware of pendingMiddlewares) {
    const existing = middlewaresByTarget.get(pendingMiddleware.target) || [];
    middlewaresByTarget.set(pendingMiddleware.target, [...existing, pendingMiddleware]);
  }

  for (const [target, middlewares] of middlewaresByTarget) {
    const reversedMiddlewares = middlewares.reverse();
    for (const middleware of reversedMiddlewares) {
      const targetPath = middleware.path || "*";
      server.hono.use(targetPath, middleware.middleware);
    }
  }
  
  pendingMiddlewares.length = 0;
}

export function getControllerMiddlewares(target: any): Array<{ middleware: MiddlewareHandler; path?: string }> {
  return Reflect.getMetadata(MIDDLEWARE_METADATA, target) || [];
}

export function methodMiddleware(middlewareHandler: MiddlewareHandler) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const methodMiddlewareKey = Symbol(`methodMiddleware_${propertyKey}`);
    Reflect.defineMetadata(methodMiddlewareKey, middlewareHandler, target, propertyKey);
    return descriptor;
  };
}

export function getMethodMiddleware(target: any, propertyKey: string): MiddlewareHandler | undefined {
  const methodMiddlewareKey = Symbol(`methodMiddleware_${propertyKey}`);
  return Reflect.getMetadata(methodMiddlewareKey, target, propertyKey);
} 