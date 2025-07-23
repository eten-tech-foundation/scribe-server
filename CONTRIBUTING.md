# Contributing Guide

Welcome to the Scribe Server repository! This guide will help you understand the project structure and development process based on the actual codebase.

## Table of Contents

- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Adding a New Feature](#adding-a-new-feature)
- [Testing](#testing)
- [Database Changes](#database-changes)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)

## Project Structure

```
src/
├── routes/               # OpenAPI route definitions
│   ├── task.route.ts            # Task CRUD routes
│   ├── health.route.ts          # Health check routes
│   └── index.route.ts           # Index/root routes
├── handlers/             # Business logic handlers
│   ├── task.handler.ts          # Task business logic
│   └── task.handler.test.ts     # Handler tests
├── db/                   # Database schema and configuration
│   ├── schema.ts                # Drizzle schema definitions
│   ├── index.ts                 # Database exports
│   └── migrations/              # Database migration files
├── lib/                  # Utility functions and configuration
│   ├── configure-open-api.ts    # OpenAPI setup
│   ├── logger.ts                # Logging configuration
│   ├── constants.ts             # Application constants
│   └── types.ts                 # Type definitions
├── middlewares/          # Custom middleware
├── server/               # Server configuration
│   └── server.ts                # Base server setup
├── test/                 # Test utilities and helpers
│   └── utils/                   # Shared test utilities
│       └── test-helpers.ts      # Mock factories and utilities
├── app.ts                # Main application setup
├── index.ts              # Application entry point
└── env.ts                # Environment configuration
```

## Development Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

   Required environment variables (see `src/env.ts`):

   ```env
   NODE_ENV=development
   PORT=9999
   LOG_LEVEL=info
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   ```

3. **Push database schema:**

   ```bash
   pnpm drizzle-kit push
   ```

4. **Start development server:**

   ```bash
   pnpm dev
   ```

5. **Run tests:**
   ```bash
   pnpm test
   ```

## Adding a New Feature

The codebase includes a complete **Tasks** feature implementation that serves as the reference pattern. When adding new features, follow the same structure and patterns used in the tasks implementation.

### Existing Tasks Implementation

The project includes a complete tasks feature with:

**1. Database Schema** (`src/db/schema.ts`):

```typescript
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  done: boolean('done').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Zod schemas for validation
export const selectTasksSchema = createSelectSchema(tasks);
export const insertTasksSchema = createInsertSchema(tasks, {
  name: (str) => str.min(1).max(500),
})
  .required({
    done: true,
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });
export const patchTasksSchema = insertTasksSchema.partial();
```

**2. Handler Functions** (`src/handlers/task.handler.ts`):

```typescript
export async function getAllTasks(): Promise<Task[]> {
  logger.debug('Fetching all tasks');
  return await db.select().from(tasks);
}

export async function getTaskById(id: number): Promise<Task | null> {
  logger.debug(`Fetching task with id: ${id}`);
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0] || null;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  logger.debug('Creating new task', input);
  const [inserted] = await db.insert(tasks).values(input).returning();
  return inserted;
}

export async function updateTask(id: number, input: UpdateTaskInput): Promise<Task | null> {
  // Implementation details in src/handlers/task.handler.ts
}

export async function deleteTask(id: number): Promise<boolean> {
  // Implementation details in src/handlers/task.handler.ts
}
```

**3. Route Definitions** (`src/routes/task.route.ts`):

```typescript
const listTasksRoute = createRoute({
  tags: ['Tasks'],
  method: 'get',
  path: '/tasks',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectTasksSchema.array().openapi('Tasks'),
      'The list of tasks'
    ),
  },
  summary: 'Get all tasks',
  description: 'Returns a list of all tasks',
});

server.openapi(listTasksRoute, async (c) => {
  logger.info('Getting all tasks');
  const tasks = await taskHandler.getAllTasks();
  return c.json(tasks);
});

const createTaskRoute = createRoute({
  tags: ['Tasks'],
  method: 'post',
  path: '/tasks',
  request: {
    body: jsonContent(insertTasksSchema, 'The task to create'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTasksSchema, 'The created task'),
  },
  summary: 'Create a new task',
});

server.openapi(createTaskRoute, async (c) => {
  const task = await c.req.json();
  logger.info('Creating task', { task });
  const created = await taskHandler.createTask(task);
  return c.json(created, HttpStatusCodes.OK);
});

// Additional routes for GET /{id}, PATCH /{id}, DELETE /{id}...
```

**4. Application Registration** (`src/app.ts`):

```typescript
import '@/routes/task.route';
import '@/routes/health.route';
import '@/routes/index.route';

configureOpenAPI(server);
export default server;
```

### Steps to Add a New Feature

To add a new feature (e.g., "Users"), follow these steps using the tasks implementation as your guide:

1. **Database Schema**: Add your table to `src/db/schema.ts` following the `tasks` table pattern
2. **Database Migration**: Run `pnpm drizzle-kit push` to apply schema changes
3. **Handler Functions**: Create `src/handlers/[feature].handler.ts` following `task.handler.ts` patterns
4. **Route Definitions**: Create `src/routes/[feature].route.ts` following `task.route.ts` patterns
5. **Application Import**: Add your route import to `src/app.ts`
6. **Tests**: Create test files following the existing `*.test.ts` patterns

### Route Definition Pattern

Routes are defined using `createRoute` from `@hono/zod-openapi` and registered with the server:

```typescript
import { createRoute } from '@hono/zod-openapi';

import * as featureHandler from '@/handlers/feature.handler';
import { server } from '@/server/server';

const listRoute = createRoute({
  tags: ['Feature'],
  method: 'get',
  path: '/features',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectFeatureSchema.array(), 'List of features'),
  },
  summary: 'Get all features',
});

server.openapi(listRoute, async (c) => {
  const features = await featureHandler.getAllFeatures();
  return c.json(features);
});
```

### Handler Function Pattern

Handlers contain pure business logic and database operations:

```typescript
import { db } from '@/db';
import { features } from '@/db/schema';
import { logger } from '@/lib/logger';

export async function getAllFeatures(): Promise<Feature[]> {
  logger.debug('Fetching all features');
  return await db.select().from(features);
}

export async function createFeature(input: CreateFeatureInput): Promise<Feature> {
  logger.debug('Creating new feature', input);
  const [inserted] = await db.insert(features).values(input).returning();
  return inserted;
}
```

## Testing

### Test Structure

We use **Vitest** for testing. Tests are placed next to the code they test:

- `src/handlers/task.handler.test.ts` - Handler tests

### Test Utilities

Use the shared test utilities in `src/test/utils/test-helpers.ts`:

```typescript
import { createMockContext, resetAllMocks, sampleTasks } from '@/test/utils/test-helpers';
```

Available utilities:

- `createMockContext()` - Mock Hono Context with common methods
- `sampleTasks` - Sample test data
- `resetAllMocks()` - Reset all mocks

### Writing Tests

Follow the existing test patterns in `src/handlers/task.handler.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';

import { createMockContext, resetAllMocks, sampleTasks } from '@/test/utils/test-helpers';

describe('Feature Handler', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should get all features', async () => {
    // Test implementation
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage
```

## Database Changes

### Schema Changes

1. Update `src/db/schema.ts` with new tables or columns
2. Push schema changes: `pnpm drizzle-kit push`
3. For production, generate proper migrations: `pnpm drizzle-kit generate`

### Environment Variables

Database configuration is handled through environment variables in `src/env.ts`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

The app validates all required environment variables on startup and will fail if any are missing.

## Code Style

### ESLint and Prettier

The project uses ESLint with `@antfu/eslint-config` and Prettier:

```bash
# Check linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Check formatting
pnpm format:check
```

### TypeScript

- Strict TypeScript configuration (`pnpm typecheck`)
- Prefer `type` over `interface` for type definitions
- Use proper typing for all functions and variables

### Naming Conventions

- **Files**: `kebab-case` (e.g., `task.handler.ts`, `task.route.ts`)
- **Functions**: `camelCase` (e.g., `getAllTasks`, `createTask`)
- **Variables**: `camelCase` (e.g., `taskData`, `userId`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `ZOD_ERROR_CODES`)

### Import Organization

Organize imports following the existing pattern:

```typescript
import type { Context } from 'hono';

import { createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { selectTasksSchema } from '@/db/schema';
import * as taskHandler from '@/handlers/task.handler';
import { logger } from '@/lib/logger';
import { server } from '@/server/server';
```

## Pull Request Process

1. **Fork the repository** and create a feature branch
2. **Make your changes** following the guidelines above
3. **Add tests** for new functionality
4. **Run the test suite** and ensure all tests pass
5. **Run linting** and fix any issues
6. **Build the project** to ensure no build errors
7. **Submit a pull request** with a clear description

### Commit Messages

Use conventional commits format:

```
feat: add user management endpoints
fix: resolve database connection issue
docs: update API documentation
test: add tests for user handler
refactor: simplify route error handling
```

### Commands to Run Before PR

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Testing
pnpm test

# Formatting
pnpm format:check

# Build
pnpm build
```

## Getting Help

- Check the [README.md](./README.md) for basic setup
- Review the existing tasks implementation as the reference pattern:
  - `src/routes/task.route.ts`
  - `src/handlers/task.handler.ts`
  - `src/handlers/task.handler.test.ts`
- Open an issue for bugs or feature requests

## Additional Resources

- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Vitest Documentation](https://vitest.dev/)
- [Zod Documentation](https://zod.dev/)
- [Stoker Documentation](https://www.npmjs.com/package/stoker)

Happy coding! 🚀
