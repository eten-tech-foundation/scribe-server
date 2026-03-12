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

// Returned by auth0.service.ts
export interface UserInvitationResult {
  user: User;
  auth0UserId: string;
  ticketUrl: string;
}

// ─── App user (session context) ───────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  role: number;
  roleName: string;
  organization: number;
  status: 'invited' | 'verified' | 'inactive';
  [key: string]: any;
}

// ─── Hono bindings ────────────────────────────────────────────────────────────

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

// ─── Error codes ──────────────────────────────────────────────────────────────

export const ErrorCode = {
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  // Resource not found — one per domain entity so routes can do
  // `code === ErrorCode.BIBLE_NOT_FOUND` instead of message string matching
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_UNIT_NOT_FOUND: 'PROJECT_UNIT_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  CHAPTER_ASSIGNMENT_NOT_FOUND: 'CHAPTER_ASSIGNMENT_NOT_FOUND',
  BIBLE_NOT_FOUND: 'BIBLE_NOT_FOUND',
  BOOK_NOT_FOUND: 'BOOK_NOT_FOUND',
  BIBLE_BOOK_NOT_FOUND: 'BIBLE_BOOK_NOT_FOUND',
  TRANSLATED_VERSE_NOT_FOUND: 'TRANSLATED_VERSE_NOT_FOUND',
  // Conflict / duplicate
  USERNAME_CONFLICT: 'USERNAME_CONFLICT',
  EMAIL_CONFLICT: 'EMAIL_CONFLICT',
  DUPLICATE: 'DUPLICATE',
  USER_ALREADY_IN_PROJECT: 'USER_ALREADY_IN_PROJECT',
  // Business rule violations (→ 400 in routes)
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  USER_NOT_IN_ORGANIZATION: 'USER_NOT_IN_ORGANIZATION',
  USER_HAS_ASSIGNED_CONTENT: 'USER_HAS_ASSIGNED_CONTENT',
  CHAPTER_LIMIT_EXCEEDED: 'CHAPTER_LIMIT_EXCEEDED',
  INVALID_REFERENCE: 'INVALID_REFERENCE',
  // External service errors
  AUTH0_ERROR: 'AUTH0_ERROR',
  EMAIL_SERVICE_ERROR: 'EMAIL_SERVICE_ERROR',
} as const;

// eslint-disable-next-line ts/no-redeclare
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface AppError {
  message: string;
  code?: ErrorCode;
  context?: Record<string, unknown>;
}

// ─── Result type + factories ──────────────────────────────────────────────────

export type Result<T, E = AppError> = { ok: true; data: T } | { ok: false; error: E };

// Factory helpers — keep handler return sites terse and consistent.
// Usage:  return ok(data)
//         return err('Not found', ErrorCode.NOT_FOUND)
//         return err('Failed', ErrorCode.INTERNAL_ERROR, { cause: e })
export const ok = <T>(data: T): Extract<Result<T>, { ok: true }> => ({ ok: true, data });
export const err = (
  message: string,
  code?: ErrorCode,
  context?: Record<string, unknown>
): Extract<Result<never>, { ok: false }> => ({ ok: false, error: { message, code, context } });

// Maps each ErrorCode to its canonical HTTP status — single source of truth
// for route handlers so they stop hard-coding 404/400/500 per error message.
export const ErrorHttpStatus: Record<ErrorCode, number> = {
  INTERNAL_ERROR: 500,
  AUTH0_ERROR: 500,
  EMAIL_SERVICE_ERROR: 500,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  USERNAME_CONFLICT: 409,
  EMAIL_CONFLICT: 409,
  DUPLICATE: 409,
  USER_ALREADY_IN_PROJECT: 409,
  VALIDATION_ERROR: 422,
  INVALID_STATUS_TRANSITION: 400,
  USER_NOT_IN_ORGANIZATION: 400,
  USER_HAS_ASSIGNED_CONTENT: 400,
  CHAPTER_LIMIT_EXCEEDED: 400,
  INVALID_REFERENCE: 400,
  NOT_FOUND: 404,
  PROJECT_NOT_FOUND: 404,
  PROJECT_UNIT_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  CHAPTER_ASSIGNMENT_NOT_FOUND: 404,
  BIBLE_NOT_FOUND: 404,
  BOOK_NOT_FOUND: 404,
  BIBLE_BOOK_NOT_FOUND: 404,
  TRANSLATED_VERSE_NOT_FOUND: 404,
};

// ─── Email service ────────────────────────────────────────────────────────────

export interface InvitationEmailData {
  email: string;
  ticketUrl: string;
  firstName?: string;
  lastName?: string;
}

export interface EmailServiceResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Database ─────────────────────────────────────────────────────────────────

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
