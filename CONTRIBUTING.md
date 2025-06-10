# Contributing Guide

Welcome to the Hono OpenAPI Starter project! This guide will help you understand the project structure and development process based on the actual codebase.

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
├── controllers/           # HTTP Controllers using decorators
│   ├── task.controller.ts        # Task CRUD controller
│   └── task.controller.test.ts   # Controller tests
├── services/             # Business logic services
│   ├── task.service.ts           # Task business logic
│   ├── task.service.test.ts      # Service tests
│   ├── logger.service.ts         # Logging service
│   ├── database.service.ts       # Database connection
│   └── config.service.ts         # Configuration service
├── db/                   # Database schema and configuration
│   ├── schema.ts                 # Drizzle schema definitions
│   ├── index.ts                  # Database exports
│   └── migrations/               # Database migration files
├── middlewares/          # Custom middleware
├── decorators/           # Route decorators (@Get, @Post, etc.)
│   ├── route.decorator.ts        # HTTP method decorators
│   ├── middleware.decorator.ts   # Middleware decorator
│   └── index.ts                  # Decorator exports
├── routes/              # Route definitions (alternative to controllers)
├── ioc/                 # Dependency injection container
│   ├── container.ts             # IoC container setup
│   └── bindings.ts              # Service bindings
├── lib/                 # Utility functions and helpers
│   └── constants.ts             # Application constants
├── server/              # Server configuration
├── test/                # Test utilities and helpers
│   └── utils/                   # Shared test utilities
│       └── test-helpers.ts      # Mock factories and utilities
├── app.ts               # Main application setup
├── index.ts             # Application entry point
└── env.ts               # Environment configuration
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

**2. Service Layer** (`src/services/task.service.ts`):
```typescript
@injectable()
export class TaskService {
  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService,
    @inject(LoggerService) private logger: LoggerService
  ) {}

  async getAllTasks(): Promise<Task[]> {
    this.logger.debug('Fetching all tasks');
    return await this.databaseService.db.select().from(tasks);
  }

  async getTaskById(id: number): Promise<Task | null> {
    // Implementation details in src/services/task.service.ts
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    // Implementation details in src/services/task.service.ts
  }

  async updateTask(id: number, input: UpdateTaskInput): Promise<Task | null> {
    // Implementation details in src/services/task.service.ts
  }

  async deleteTask(id: number): Promise<boolean> {
    // Implementation details in src/services/task.service.ts
  }
}
```

**3. Controller Layer** (`src/controllers/task.controller.ts`):
```typescript
@baseRoute('/tasks')
@middleware(async (ctx, next) => {
  console.log('middleware 1');
  await next();
})
@middleware(async (ctx, next) => {
  console.log('middleware 2');
  await next();
})
@injectable()
export class TaskController {
  constructor(
    @inject(TaskService) private readonly taskService: TaskService,
    @inject(LoggerService) private readonly logger: LoggerService
  ) {}

  @Get({
    path: '/',
    tags: ['Tasks'],
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        selectTasksSchema.array().openapi('Tasks'),
        'The list of tasks'
      ),
    },
  })
  async list(ctx: Context): Promise<Response> {
    // Full implementation in src/controllers/task.controller.ts
  }

  @Post({ /* ... */ })
  async create(ctx: Context): Promise<Response> { /* ... */ }

  @Get({ path: '/{id}', /* ... */ })
  async getOne(ctx: Context): Promise<Response> { /* ... */ }

  @Patch({ path: '/{id}', /* ... */ })
  async patch(ctx: Context): Promise<Response> { /* ... */ }

  @Delete({ path: '/{id}', /* ... */ })
  async remove(ctx: Context): Promise<Response> { /* ... */ }
}
```

**4. IoC Registration** (`src/ioc/bindings.ts`):
```typescript
export function bindToContainers(container: Container): void {
  // Services
  container.bind(TaskService).toSelf().inRequestScope();
  
  // Controllers
  container.bind(TaskController).toSelf().inRequestScope();
}
```

### Steps to Add a New Feature

To add a new feature (e.g., "Users"), follow these steps using the tasks implementation as your guide:

1. **Database Schema**: Add your table to `src/db/schema.ts` following the `tasks` table pattern
2. **Database Migration**: Run `pnpm drizzle-kit push` to apply schema changes
3. **Service Layer**: Create `src/services/[feature].service.ts` following `TaskService` patterns
4. **Controller**: Create `src/controllers/[feature].controller.ts` following `TaskController` patterns  
5. **IoC Bindings**: Add your service and controller to `src/ioc/bindings.ts`
6. **Tests**: Create test files following the existing `*.test.ts` patterns

### Understanding Decorators

#### `@baseRoute(basePath: string)`

Sets the base path for all routes in a controller (see `TaskController`):

```typescript
@baseRoute('/tasks')  // All routes prefixed with /tasks
export class TaskController {
  @Get({ path: '/' })        // Results in GET /tasks
  @Get({ path: '/{id}' })    // Results in GET /tasks/{id}
}
```

#### `@middleware(middlewareHandler: MiddlewareHandler)`

Applies middleware to all routes in a controller (see `TaskController`):

```typescript
@middleware(async (ctx, next) => {
  console.log('middleware 1');
  await next();
})
@middleware(async (ctx, next) => {
  console.log('middleware 2');
  await next();
})
export class TaskController {
  // All routes will have both middleware applied in order
}
```

## Testing

### Test Structure

We use **Vitest** for testing. Tests are placed next to the code they test:

- `src/controllers/task.controller.test.ts` - Controller tests
- `src/services/task.service.test.ts` - Service tests

### Test Utilities

Use the shared test utilities in `src/test/utils/test-helpers.ts`:

```typescript
import { 
  createMockContext, 
  createMockLogger, 
  createMockTaskService,
  sampleTasks,
  resetAllMocks 
} from '@/test/utils/test-helpers';
```

Available utilities:
- `createMockTaskService()` - Mock TaskService with all methods
- `createMockLogger()` - Mock LoggerService 
- `createMockContext()` - Mock Hono Context
- `sampleTasks` - Sample test data
- `resetAllMocks()` - Reset all mocks

### Writing Tests

Follow the existing test patterns in:
- `src/controllers/task.controller.test.ts` for controller testing patterns
- `src/services/task.service.test.ts` for service testing patterns

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

- **Files**: `kebab-case` (e.g., `task.controller.ts`)
- **Classes**: `PascalCase` (e.g., `TaskController`)
- **Functions/Variables**: `camelCase` (e.g., `getTaskById`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `ZOD_ERROR_CODES`)

### Import Organization

Organize imports following the existing pattern:

```typescript
import type { Context } from 'hono';

import { z } from '@hono/zod-openapi';
import { inject, injectable } from 'inversify';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { selectTasksSchema } from '@/db/schema';
import { LoggerService } from '@/services/logger.service';

import { validateInput } from './helpers';
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
test: add tests for user service
refactor: simplify controller error handling
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
  - `src/controllers/task.controller.ts`
  - `src/services/task.service.ts` 
  - `src/controllers/task.controller.test.ts`
  - `src/services/task.service.test.ts`
- Open an issue for bugs or feature requests

## Additional Resources

- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)  
- [Vitest Documentation](https://vitest.dev/)
- [Zod Documentation](https://zod.dev/)
- [Stoker Documentation](https://www.npmjs.com/package/stoker)

Happy coding! 🚀
