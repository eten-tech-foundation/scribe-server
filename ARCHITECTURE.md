# Architecture Overview

This document describes the high-level architecture and design patterns used in the Fluent API.

## Architectural Style

**Domain-Driven Design (DDD) inspired Modular Monolith**

The codebase follows a domain-driven, modular monolith architecture with clear business domain boundaries. While deployed as a single unit, the code is organized around business capabilities rather than technical layers.

## Project Structure

```
src/
├── domains/           # Business domains (bounded contexts)
│   ├── chapter-assignments/
│   ├── projects/
│   ├── users/
│   └── ...
├── lib/              # Shared infrastructure
├── middlewares/      # Cross-cutting concerns
└── db/               # Database layer
```

## Domain Module Pattern

Each domain is self-contained and follows a consistent internal structure:

| File | Responsibility |
|------|---------------|
| `{domain}.service.ts` | Business logic, orchestration, and use cases |
| `{domain}.repository.ts` | Data access, persistence, and queries |
| `{domain}.route.ts` | HTTP route handlers (presentation layer) |
| `{domain}.types.ts` | Domain-specific TypeScript types |
| `{domain}.policy.ts` | Authorization and access control rules |
| `{domain}.middleware.ts` | Domain-specific request processing |

### Cross-Domain Relationships

- **Internal**: Services interact with repositories within the same domain
- **Cross-Domain**: Domain services expose public functions for other domains to call
- **Avoid**: Repositories should not be accessed directly from outside their domain

## Layer Responsibilities

### Service Layer

- Encapsulates business logic and domain rules
- Orchestrates operations across multiple repositories
- Handles transactions and error management
- Returns `Result<T>` types for explicit error handling

```typescript
// Example: src/domains/chapter-assignments/chapter-assignments.service.ts
export async function createChapterAssignment(data: CreateChapterAssignmentRequestData) {
  return db.transaction(async (tx) => {
    const assignment = await repo.insert(data, tx);
    await repo.insertStatusHistory(tx, assignment.id, CHAPTER_ASSIGNMENT_STATUS.NOT_STARTED);
    return ok(toChapterAssignmentResponse(assignment));
  });
}
```

### Repository Layer

- Handles all database operations
- Contains raw SQL queries using Drizzle ORM
- Returns plain data objects, never business objects
- Supports transactions via `DbTransaction` parameter

### Route Layer

- HTTP request handlers using Hono framework
- Validates input using Zod schemas
- Delegates to services for business logic
- Returns standardized responses

### Policy Layer

- Authorization logic for domain resources
- Evaluates user permissions against resource state
- Used by middleware for access control

## Error Handling

The project uses a **Result type pattern** for explicit error handling:

```typescript
type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorCode };
```

Services return `Result<T>` instead of throwing exceptions, forcing callers to handle both success and failure cases explicitly.

## Technology Stack

- **Framework**: [Hono](https://hono.dev/) - Lightweight web framework
- **ORM**: [Drizzle](https://orm.drizzle.team/) - Type-safe SQL
- **Database**: PostgreSQL
- **Validation**: Zod
- **Testing**: Vitest
- **Authentication**: Auth0 (via middleware)

## Design Principles

1. **Domain boundaries are respected** — code within a domain should not leak abstractions
2. **Services orchestrate, repositories execute** — clear separation of concerns
3. **Explicit error handling** — Result types over exceptions for business errors
4. **Type safety** — Leverage TypeScript for compile-time correctness
5. **Minimal cross-domain dependencies** — Keep domains loosely coupled

## Type Organization

Types are distributed across files based on their scope and usage. Follow these guidelines to maintain consistency:

### `{domain}.types.ts` — The Central Type Registry

This file is the **canonical source** for domain types that are shared across layers:

| Category | What belongs here | Examples |
|----------|-------------------|----------|
| **Domain Constants** | Enums and action constants used across the domain | `CHAPTER_ASSIGNMENT_STATUS`, `USER_ACTIONS` |
| **DB-Derived Types** | Types inferred from Drizzle schema | `ChapterAssignmentRecord = z.infer<typeof selectChapterAssignmentsSchema>` |
| **Service Input Types** | Interfaces for service function parameters | `CreateChapterAssignmentRequestData`, `UpdateUserInput` |
| **API Response Schemas** | Zod schemas for responses (used in routes and tests) | `chapterAssignmentResponseSchema` |
| **Reusable Request Schemas** | Zod schemas for request bodies used in multiple routes | `createUserRequestSchema`, `updateUserRequestSchema` |

**Guideline**: If a type is imported by more than one file in the domain, it belongs in `types.ts`.

### `{domain}.repository.ts` — Repository-Specific Types

Define types here **only** when they are:

- Specific to a single repository query (query result shapes with joins)
- Not needed outside the repository layer
- Extensions of base types for specific use cases

```typescript
// Repository-specific type for a complex join query
export interface ChapterAssignmentWithAuthContext extends ChapterAssignmentRecord {
  projectId: number;
  organizationId: number;
  isProjectMember: boolean;
}
```

**Guideline**: Keep these minimal. If another layer needs this type, move it to `types.ts`.

### `{domain}.route.ts` — Route-Specific Schemas

Route files should:

- **Import** request/response schemas from `types.ts` when they are standardized
- **Define inline** only for one-off request bodies that are not reusable

```typescript
// Good: Import shared schemas
import { chapterAssignmentResponseSchema, createChapterAssignmentSchema } from './chapter-assignments.types';

// Acceptable: Inline for simple, non-reusable request bodies
const updateStatusRoute = createRoute({
  request: {
    body: jsonContent(
      z.object({ status: z.enum(['draft', 'complete']) }),  // Simple, one-off
      'Status update'
    ),
  },
});
```

### Decision Matrix

| If the type is... | Put it in... |
|-------------------|--------------|
| A domain constant or enum used across files | `types.ts` |
| Derived from a Drizzle schema | `types.ts` |
| Service function input/output | `types.ts` |
| An API response schema | `types.ts` |
| A request schema used in multiple routes | `types.ts` |
| Specific to one repository query with joins | `repository.ts` |
| Only needed for a single simple route | Inline in `route.ts` |

## Adding a New Domain

When creating a new domain module:

1. Create a new folder under `src/domains/{domain-name}/`
2. Add the standard files: `types.ts`, `repository.ts`, `service.ts`, `route.ts`
3. Define domain types in `types.ts`
4. Implement data access in `repository.ts`
5. Add business logic in `service.ts`
6. Wire up routes in `route.ts`
7. Export routes from `app.ts`
