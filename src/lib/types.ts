import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { Schema } from 'hono';
import type { PinoLogger } from 'hono-pino';

// Auth0 JWT Payload types
export interface Auth0JWTPayload {
  iss: string; // Issuer (Auth0 domain)
  sub: string; // Subject (user ID)
  aud: string | string[]; // Audience
  iat: number; // Issued at
  exp: number; // Expiration time
  azp?: string; // Authorized party
  scope?: string; // Scopes

  // Auth0 user claims
  email?: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;

  // Custom claims (namespace prefixed)
  [key: string]: any;
}

// User
export interface User {
  id: number;
  email: string;
  role: number;
  organization: number;
  isActive: boolean;
  [key: string]: any;
}

export interface AppBindings {
  Variables: {
    logger: PinoLogger;
    jwtPayload?: Auth0JWTPayload;
    user?: User;
    requestId: string;
    loggedInUserEmail?: string;
  };
}

// eslint-disable-next-line ts/no-empty-object-type
export type AppOpenAPI<S extends Schema = {}> = OpenAPIHono<AppBindings, S>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;

// Generic Result type
export type Result<T, E = { message: string }> = { ok: true; data: T } | { ok: false; error: E };
