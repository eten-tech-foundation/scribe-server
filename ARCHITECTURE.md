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

## Adding a New Domain

When creating a new domain module:

1. Create a new folder under `src/domains/{domain-name}/`
2. Add the standard files: `types.ts`, `repository.ts`, `service.ts`, `route.ts`
3. Define domain types in `types.ts`
4. Implement data access in `repository.ts`
5. Add business logic in `service.ts`
6. Wire up routes in `route.ts`
7. Export routes from `app.ts`
