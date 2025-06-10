# Contributing Guide

Welcome to the Hono OpenAPI Starter project! This guide will help you understand the project structure and development process.

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
├── services/             # Business logic services
├── db/                   # Database schema and configuration
├── middlewares/          # Custom middleware
├── decorators/           # Route decorators (@Get, @Post, etc.)
├── routes/              # Route definitions (if not using controllers)
├── ioc/                 # Dependency injection container
├── lib/                 # Utility functions and helpers
├── server/              # Server configuration
├── test/                # Test utilities and helpers
│   └── utils/           # Shared test utilities
├── app.ts               # Main application setup
├── index.ts             # Application entry point
└── env.ts               # Environment configuration
```

## Development Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Run database migrations:**

   ```bash
   npm run db:migrate
   ```

4. **Start development server:**

   ```bash
   npm run dev
   ```

5. **Run tests:**
   ```bash
   npm test
   ```

## Adding a New Feature

When adding a new feature (e.g., a "User" entity), follow these steps:

### 1. Database Schema

Create or update the database schema in `src/db/schema.ts`:

```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Create Zod schemas for validation
export const selectUsersSchema = createSelectSchema(users);
export const insertUsersSchema = createInsertSchema(
  users,
  {
    email: str => str.email(),
    name: str => str.min(1).max(100),
  },
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const patchUsersSchema = insertUsersSchema.partial();
```

### 2. Database Migration

Generate and run a migration:

```bash
npm run db:generate
npm run db:migrate
```

### 3. Service Layer

Create a service in `src/services/user.service.ts`:

```typescript
import type { z } from "@hono/zod-openapi";

import { eq } from "drizzle-orm";
import { inject, injectable } from "inversify";

import type { insertUsersSchema, patchUsersSchema, selectUsersSchema } from "@/db/schema";

import { users } from "@/db/schema";

import { DatabaseService } from "./database.service";
import { LoggerService } from "./logger.service";

export type User = z.infer<typeof selectUsersSchema>;
export type CreateUserInput = z.infer<typeof insertUsersSchema>;
export type UpdateUserInput = z.infer<typeof patchUsersSchema>;

@injectable()
export class UserService {
  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService,
    @inject(LoggerService) private logger: LoggerService,
  ) {}

  async getAllUsers(): Promise<User[]> {
    this.logger.debug("Fetching all users");
    return await this.databaseService.db.select().from(users);
  }

  async getUserById(id: number): Promise<User | null> {
    this.logger.debug(`Fetching user with id: ${id}`);
    const result = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0] || null;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    this.logger.debug("Creating new user", input);
    const [inserted] = await this.databaseService.db
      .insert(users)
      .values(input)
      .returning();
    return inserted;
  }

  async updateUser(id: number, input: UpdateUserInput): Promise<User | null> {
    this.logger.debug(`Updating user with id: ${id}`, input);

    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      this.logger.warn(`User with id ${id} not found for update`);
      return null;
    }

    const [updated] = await this.databaseService.db
      .update(users)
      .set(input)
      .where(eq(users.id, id))
      .returning();
    return updated || null;
  }

  async deleteUser(id: number): Promise<boolean> {
    this.logger.debug(`Deleting user with id: ${id}`);

    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      this.logger.warn(`User with id ${id} not found for deletion`);
      return false;
    }

    const result = await this.databaseService.db
      .delete(users)
      .where(eq(users.id, id));
    return result.count > 0;
  }
}
```

### 4. Controller

Create a controller in `src/controllers/user.controller.ts`:

```typescript
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { inject, injectable } from "inversify";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

import { insertUsersSchema, patchUsersSchema, selectUsersSchema } from "@/db/schema";
import { baseRoute, Delete, Get, middleware, Patch, Post } from "@/decorators";
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from "@/lib/constants";
import { LoggerService } from "@/services/logger.service";
import { UserService } from "@/services/user.service";

// Example middleware functions
const authMiddleware = async (c, next) => {
  const token = c.req.header("Authorization");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  // Token validation logic here
  await next();
};

const loggingMiddleware = async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
};

const rateLimitMiddleware = async (c, next) => {
  // Rate limiting logic here
  await next();
};

// Using @baseRoute and @middleware decorators
@baseRoute("/api/v1")                    // All routes will be prefixed with /api/v1
@middleware(loggingMiddleware)            // Applied to all routes in this controller
@middleware(rateLimitMiddleware)          // Applied to all routes in this controller  
@middleware(authMiddleware, "/api/v1/admin/*")  // Only applied to admin routes
@injectable()
export class UserController {
  constructor(
    @inject(UserService) private readonly userService: UserService,
    @inject(LoggerService) private readonly logger: LoggerService,
  ) {}

  @Get({
    path: "/users",                       // Results in GET /api/v1/users
    tags: ["Users"],
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        selectUsersSchema.array().openapi("Users"),
        "The list of users",
      ),
    },
  })
  async list(ctx: Context): Promise<Response> {
    this.logger.info("Getting all users");
    const users = await this.userService.getAllUsers();
    return ctx.json(users);
  }

  @Post({
    path: "/users",                       // Results in POST /api/v1/users
    tags: ["Users"],
    request: {
      body: jsonContent(insertUsersSchema, "The user to create"),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(selectUsersSchema, "The created user"),
    },
  })
  async create(ctx: Context): Promise<Response> {
    const user = await ctx.req.json();
    this.logger.info("Creating user", { user });
    const created = await this.userService.createUser(user);
    return ctx.json(created, HttpStatusCodes.OK);
  }

  @Get({
    path: "/admin/users",                 // Results in GET /api/v1/admin/users (with auth middleware)
    tags: ["Admin"],
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        selectUsersSchema.array().openapi("Users"),
        "All users with admin details",
      ),
    },
  })
  async adminList(ctx: Context): Promise<Response> {
    // This route will have auth middleware applied due to path matching
    const users = await this.userService.getAllUsers();
    return ctx.json(users);
  }

  // Add other methods (getOne, patch, remove) following the same pattern...
}
```

#### Understanding Decorators

##### `@baseRoute(basePath: string)`

The `@baseRoute` decorator allows you to define a base path for all routes in a controller, eliminating repetition:

**Without @baseRoute:**
```typescript
@Get({ path: "/api/v1/users" })        // GET /api/v1/users
@Post({ path: "/api/v1/users" })       // POST /api/v1/users
@Get({ path: "/api/v1/users/{id}" })   // GET /api/v1/users/{id}
```

**With @baseRoute:**
```typescript
@baseRoute("/api/v1")
export class UserController {
  @Get({ path: "/users" })             // GET /api/v1/users  
  @Post({ path: "/users" })            // POST /api/v1/users
  @Get({ path: "/users/{id}" })        // GET /api/v1/users/{id}
}
```

**Special path handling:**
- `path: "/"` with `@baseRoute("/api/v1")` → `/api/v1`
- `path: "/users"` with `@baseRoute("/api/v1")` → `/api/v1/users`
- `path: "users"` with `@baseRoute("/api/v1")` → `/api/v1/users`

##### `@middleware(middlewareHandler: MiddlewareHandler, path?: string)`

The `@middleware` decorator allows you to apply Hono middleware functions to controllers:

**Basic usage (applies to all routes in controller):**
```typescript
import type { MiddlewareHandler } from "hono";

const logMiddleware: MiddlewareHandler = async (c, next) => {
  console.log(`Request: ${c.req.method} ${c.req.url}`);
  await next();
};

@middleware(logMiddleware)
@baseRoute("/api/v1")
export class UserController {
  // All routes will have logging middleware
}
```

**Path-specific middleware:**
```typescript
@middleware(authMiddleware, "/api/v1/admin/*")  // Only admin routes
@middleware(corsMiddleware, "/api/v1/public/*") // Only public routes
@baseRoute("/api/v1")
export class UserController {
  @Get({ path: "/admin/users" })     // Has auth middleware
  @Get({ path: "/public/info" })     // Has CORS middleware  
  @Get({ path: "/users" })           // No path-specific middleware
}
```

**Multiple middleware (executes in declaration order):**
```typescript
@middleware(requestIdMiddleware)      // Executes first
@middleware(loggingMiddleware)        // Executes second  
@middleware(rateLimitMiddleware)      // Executes third
@baseRoute("/api/v1")
export class UserController {
  // All routes will have all three middleware in order
}
```

**Real-world example:**
```typescript
import type { MiddlewareHandler } from "hono";

// Define middleware functions
const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
};

const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = c.req.header("Authorization");
  if (!token?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  // Verify JWT token here
  await next();
};

const adminMiddleware: MiddlewareHandler = async (c, next) => {
  // Check if user has admin role
  const userRole = c.get("userRole"); 
  if (userRole !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
};

// Apply middleware to controller
@baseRoute("/api/v1/users")
@middleware(requestIdMiddleware)                    // All routes get request ID
@middleware(authMiddleware)                         // All routes require auth
@middleware(adminMiddleware, "/api/v1/users/admin/*") // Only admin routes
@injectable()
export class UserController {
  @Get({
    path: "/",                          // GET /api/v1/users (auth required)
    tags: ["Users"],
    responses: {
      200: jsonContent(usersSchema.array(), "List of users"),
    },
  })
  async getUsers(ctx: Context) {
    const requestId = ctx.get("requestId");
    // Implementation
    return ctx.json([]);
  }

  @Get({
    path: "/admin/analytics",           // GET /api/v1/users/admin/analytics (auth + admin required)
    tags: ["Admin"],
    responses: {
      200: jsonContent(analyticsSchema, "User analytics"),
    },
  })
  async getAnalytics(ctx: Context) {
    // Only admins can access this endpoint
    return ctx.json({ totalUsers: 100 });
  }
}
```

### 5. Register Dependencies

Add the new service to the IoC container in `src/ioc/bindings.ts`:

```typescript
import { UserService } from "@/services/user.service";

// Add this line
container.bind(UserService).toSelf().inRequestScope();
```

### 6. Register Controller

Import and register the controller in `src/app.ts`:

```typescript
import { UserController } from "@/controllers/user.controller";

// Add after other controller registrations
const userController = container.get(UserController);
// Register routes if using manual setup
```

## Testing

### Test Structure

We use **Vitest** for testing. Tests should be placed next to the code they test:

- `src/controllers/[name].controller.test.ts` - Controller tests
- `src/services/[name].service.test.ts` - Service tests

### Test Utilities

Use the shared test utilities in `src/test/utils/test-helpers.ts`:

```typescript
import { createMockContext, createMockLogger, sampleTasks } from "@/test/utils/test-helpers";
```

### Writing Controller Tests

Example controller test structure:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockContext, createMockLogger } from "@/test/utils/test-helpers";

import { UserController } from "./user.controller";

const mockUserService = {
  getAllUsers: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
} as unknown as UserService;

describe("UserController", () => {
  let userController: UserController;
  let mockLogger: LoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    userController = new UserController(mockUserService, mockLogger);
  });

  describe("list", () => {
    it("should return all users", async () => {
      const mockUsers = [/* test data */];
      mockUserService.getAllUsers = vi.fn().mockResolvedValue(mockUsers);
      const ctx = createMockContext();

      await userController.list(ctx);

      expect(mockUserService.getAllUsers).toHaveBeenCalledOnce();
      expect(ctx.json).toHaveBeenCalledWith(mockUsers);
    });
  });
});
```

### Writing Service Tests

Example service test structure:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockLogger } from "@/test/utils/test-helpers";

import { UserService } from "./user.service";

const mockDatabaseService = {
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
} as unknown as DatabaseService;

describe("UserService", () => {
  let userService: UserService;
  let mockLogger: LoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    userService = new UserService(mockDatabaseService, mockLogger);
  });

  // Add tests here...
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Database Changes

### Schema Changes

1. Update `src/db/schema.ts` with new tables or columns
2. Generate migration: `npm run db:generate`
3. Review the generated migration file
4. Run migration: `npm run db:migrate`

### Migration Files

Migration files are stored in `drizzle/` directory. Always review generated migrations before applying them.

### Environment Variables

Database configuration is handled through environment variables:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

## Code Style

### ESLint and Prettier

The project uses ESLint and Prettier for code formatting:

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### TypeScript

- Use strict TypeScript configuration
- Prefer `type` over `interface` for type definitions
- Use proper typing for all functions and variables

### Naming Conventions

- **Files**: `kebab-case` (e.g., `user.controller.ts`)
- **Classes**: `PascalCase` (e.g., `UserController`)
- **Functions/Variables**: `camelCase` (e.g., `getUserById`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `HTTP_STATUS_CODES`)

### Import Organization

Organize imports in this order:

1. Node.js built-in modules
2. External packages
3. Internal modules (using `@/` alias)
4. Relative imports

```typescript
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { inject, injectable } from "inversify";

import { LoggerService } from "@/services/logger.service";
import { UserService } from "@/services/user.service";

import { validateInput } from "./helpers";
```

## Pull Request Process

1. **Fork the repository** and create a feature branch
2. **Make your changes** following the guidelines above
3. **Add tests** for new functionality
4. **Run the test suite** and ensure all tests pass
5. **Run linting** and fix any issues
6. **Update documentation** if needed
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

### Pull Request Template

Include in your PR description:

- **What**: Brief description of changes
- **Why**: Reason for the changes
- **How**: Implementation approach
- **Testing**: How the changes were tested
- **Breaking Changes**: Any breaking changes (if applicable)

## Getting Help

- Check the [README.md](./README.md) for basic setup
- Review existing code for patterns and examples
- Open an issue for bugs or feature requests
- Ask questions in discussions

## Additional Resources

- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Vitest Documentation](https://vitest.dev/)
- [Zod Documentation](https://zod.dev/)

Happy coding! 🚀
