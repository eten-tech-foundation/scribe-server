import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import type { Schema } from 'hono';
import type { PinoLogger } from 'hono-pino';

import type * as schema from '@/db/schema';

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
  status: 'invited' | 'verified' | 'inactive';
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

export type DbTransaction = PgTransaction<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

// USJ Types

// Root Interface

export interface USJDocument {
  type: 'USJ';

  version: string;

  content: USJNode[];
}

// Union of all possible Node types

export type USJNode = BookNode | ChapterNode | ParaNode | VerseNode | CharNode;

// 1. Book Node (Metadata)

export interface BookNode {
  type: 'book';

  marker: 'id';

  code: string; // e.g., "GEN"

  content?: never[]; // Usually empty for 'id' markers
}

// 2. Chapter Node (Milestone - typically has no content array)

export interface ChapterNode {
  type: 'chapter';

  marker: 'c';

  number: string;

  sid?: string; // e.g., "GEN 5"
}

// 3. Paragraph Node (Container - holds verses and text)

export interface ParaNode {
  type: 'para';

  marker: 'h' | 'mt' | 'p' | 'q' | string; // headers, main titles, paragraphs, poetry

  content: (USJNode | string)[]; // Can contain other nodes OR raw text strings
}

// 4. Verse Node (Milestone - marks the start of a verse)

export interface VerseNode {
  type: 'verse';

  marker: 'v';

  number: string;

  sid?: string; // e.g., "GEN 5:1"
}

// 5. Character/Style Node (Optional, for words in bold, italic, etc.)

export interface CharNode {
  type: 'char';

  marker: string;

  content: (USJNode | string)[];
}
