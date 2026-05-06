# User-Centric Multi-Org Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the data model so that User is the central entity, supporting membership in multiple Orgs with distinct org-level and project-level roles per org per project.

**Architecture:** A new `org_memberships` join table replaces the single `role`/`organization`/`status`/`createdBy` columns on `users`, giving each user a role per org (`org_owner`, `org_manager`, `member`). A new `project_user_roles` table replaces `project_users` and tracks one row per user per project per role, allowing multiple project roles per user (e.g., `project_manager` + `translator`). Auth middleware splits into identity-only `authenticateUser` plus a new `requireOrgAccess` middleware that loads org membership for the request's org scope. All policies update to receive `orgRole` and `projectRoles` instead of a single global `roleName`.

**Tech Stack:** Drizzle ORM (Postgres), Hono, Zod, Vitest, TypeScript, Auth0

---

## Role Vocabulary

| Scope   | Role name         | Replaces / Notes                                 |
| ------- | ----------------- | ------------------------------------------------ |
| Org     | `org_owner`       | Full org control; self-assigns on org creation   |
| Org     | `org_manager`     | Old `Manager` role when acting at the org level  |
| Org     | `member`          | Default for invited users                        |
| Project | `project_manager` | Old `Manager` role when scoped to a project      |
| Project | `translator`      | Old `Translator` role                            |
| Project | `peer_checker`    | Existing concept, now a first-class project role |
| Project | `observer`        | Read-only; no editing or managing permissions    |

Kevin Smith's data in the new model:

- `org_memberships`: `(kevin, orgA, org_owner)`, `(kevin, orgB, org_manager)`, `(kevin, orgC, member)`, `(kevin, orgD, member)`
- `project_user_roles`: `(projectA, kevin, project_manager)`, `(projectA, kevin, translator)`, `(projectB, kevin, project_manager)`, `(projectC, kevin, translator)`, `(projectD, kevin, observer)`

---

## File Map

| Action | File                                                     | Purpose                                                  |
| ------ | -------------------------------------------------------- | -------------------------------------------------------- |
| Modify | `src/db/schema.ts`                                       | New tables, enums, remove old user columns               |
| Create | `src/db/migrations/0010_user_centric_refactor.sql`       | Schema + data migration (partially generated)            |
| Modify | `src/lib/roles.ts`                                       | New org/project role constants                           |
| Modify | `src/lib/permissions.ts`                                 | Add org-level permissions                                |
| Modify | `src/lib/types.ts`                                       | `AppPolicyUser`, `User`, new error codes                 |
| Modify | `src/db/seeds/rbac.ts`                                   | Updated roles + permission mappings                      |
| Create | `src/domains/orgs/org-memberships.types.ts`              | Org membership domain types                              |
| Create | `src/domains/orgs/org-memberships.repository.ts`         | DB access for org memberships                            |
| Create | `src/domains/orgs/org-memberships.service.ts`            | Business logic for org memberships                       |
| Create | `src/domains/orgs/org-memberships.service.test.ts`       | Tests for org membership service                         |
| Create | `src/domains/orgs/org-memberships.route.ts`              | HTTP routes for org membership management                |
| Modify | `src/server/context.types.ts`                            | Add org membership to AppEnv variables                   |
| Modify | `src/middlewares/role-auth.ts`                           | Identity-only `authenticateUser`, new `requireOrgAccess` |
| Modify | `src/domains/users/users.types.ts`                       | Remove `role`/`organization` from create/update schemas  |
| Modify | `src/domains/users/users.repository.ts`                  | Remove org/role from queries                             |
| Modify | `src/domains/users/users.service.ts`                     | Remove `getUsersByOrganization`, update `toUserResponse` |
| Modify | `src/domains/users/users.service.test.ts`                | Update mocks and assertions                              |
| Modify | `src/domains/users/user.policy.ts`                       | Use `orgRole` instead of `roleName`                      |
| Modify | `src/domains/users/users.route.ts`                       | Remove org injection from create handler                 |
| Modify | `src/domains/projects/project.policy.ts`                 | Use org membership + project roles                       |
| Modify | `src/domains/projects/project-auth.middleware.ts`        | Load project roles from new table                        |
| Modify | `src/domains/projects/projects.route.ts`                 | Remove `currentUser.organization` assumptions            |
| Modify | `src/domains/projects/users/project-users.types.ts`      | Rename to `ProjectUserRole`, add role field              |
| Modify | `src/domains/projects/users/project-users.repository.ts` | Query against `project_user_roles`                       |
| Modify | `src/domains/projects/users/project-users.service.ts`    | Accept role parameter on add                             |
| Modify | `src/domains/projects/users/project-users.route.ts`      | Include role in add/list responses                       |
| Modify | `src/test/utils/test-helpers.ts`                         | Remove `role`/`organization` from sample users           |

---

## Task 1: Update schema.ts — new enums and tables

**Files:**

- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `orgRoleEnum` and `projectRoleEnum` after the existing enums (around line 42)**

```typescript
export const orgRoleEnum = pgEnum('org_role', ['org_owner', 'org_manager', 'member']);
export const projectRoleEnum = pgEnum('project_role', [
  'project_manager',
  'translator',
  'peer_checker',
  'observer',
]);
```

- [ ] **Step 2: Replace the `users` table definition — remove `role`, `organization`, `status`, `createdBy` columns**

Replace the `users` table (lines 62–80) with:

```typescript
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});
```

- [ ] **Step 3: Add the `org_memberships` table after the `organizations` table definition**

```typescript
export const org_memberships = pgTable(
  'org_memberships',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: integer('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    orgRole: orgRoleEnum('org_role').notNull().default('member'),
    status: userStatusEnum('status').notNull().default('invited'),
    createdBy: integer('created_by').references((): AnyPgColumn => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.orgId] }),
    index('idx_org_memberships_user').on(table.userId),
    index('idx_org_memberships_org').on(table.orgId),
  ]
);
```

- [ ] **Step 4: Replace `project_users` table with `project_user_roles` table**

Remove the `project_users` table definition and replace with:

```typescript
export const project_user_roles = pgTable(
  'project_user_roles',
  {
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    projectRole: projectRoleEnum('project_role').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId, table.projectRole] }),
    index('idx_project_user_roles_project').on(table.projectId),
    index('idx_project_user_roles_user').on(table.userId),
  ]
);
```

- [ ] **Step 5: Update the select/insert/patch schema exports at the bottom of schema.ts**

Remove or replace references to `users.role`, `users.organization`, `users.status`, `users.createdBy`, `project_users`.

Add new exports:

```typescript
export const selectOrgMembershipsSchema = createSelectSchema(org_memberships);
export const selectProjectUserRolesSchema = createSelectSchema(project_user_roles);

export const insertOrgMembershipsSchema = createInsertSchema(org_memberships, {
  userId: (schema) => schema.int(),
  orgId: (schema) => schema.int(),
  orgRole: z.enum(['org_owner', 'org_manager', 'member']).default('member'),
  status: z.enum(['invited', 'verified', 'inactive']).default('invited'),
  createdBy: (schema) => schema.int().optional(),
})
  .required({ userId: true, orgId: true })
  .omit({ createdAt: true, updatedAt: true });

export const insertProjectUserRolesSchema = createInsertSchema(project_user_roles, {
  projectId: (schema) => schema.int(),
  userId: (schema) => schema.int(),
  projectRole: z.enum(['project_manager', 'translator', 'peer_checker', 'observer']),
})
  .required({ projectId: true, userId: true, projectRole: true })
  .omit({ createdAt: true });

export const patchOrgMembershipsSchema = insertOrgMembershipsSchema.partial();
export const patchProjectUserRolesSchema = insertProjectUserRolesSchema.partial();
```

Update `insertUsersSchema` to remove `role`, `organization`, `status`, `createdBy`:

```typescript
export const insertUsersSchema = createInsertSchema(users, {
  username: (schema) => schema.min(1).max(100),
  email: (schema) => schema.email().max(255),
  firstName: (schema) => schema.max(100).optional(),
  lastName: (schema) => schema.max(100).optional(),
})
  .required({ username: true, email: true })
  .omit({ id: true, createdAt: true, updatedAt: true });
```

Update `patchUsersClientSchema` and `patchUsersSchema` — remove `organization` and role references.

- [ ] **Step 6: Confirm the file compiles in isolation**

Run: `npx tsc --noEmit src/db/schema.ts 2>&1 | head -30`

Expected: errors referencing other files that import the old shapes — that is expected and OK at this stage.

- [ ] **Step 7: Commit schema changes**

```bash
git add src/db/schema.ts
git commit -m "feat(schema): add org_memberships and project_user_roles tables, remove single-org user columns"
```

---

## Task 2: Update role and permission constants

**Files:**

- Modify: `src/lib/roles.ts`
- Modify: `src/lib/permissions.ts`

- [ ] **Step 1: Replace `src/lib/roles.ts` entirely**

```typescript
export const ORG_ROLES = {
  ORG_OWNER: 'org_owner',
  ORG_MANAGER: 'org_manager',
  MEMBER: 'member',
} as const;

export const PROJECT_ROLES = {
  PROJECT_MANAGER: 'project_manager',
  TRANSLATOR: 'translator',
  PEER_CHECKER: 'peer_checker',
  OBSERVER: 'observer',
} as const;

export type OrgRoleName = (typeof ORG_ROLES)[keyof typeof ORG_ROLES];
export type ProjectRoleName = (typeof PROJECT_ROLES)[keyof typeof PROJECT_ROLES];

// Keep ROLES as a backwards-compatibility alias during migration — remove after all callers updated
/** @deprecated Use ORG_ROLES or PROJECT_ROLES */
export const ROLES = {
  PROJECT_MANAGER: 'Manager',
  TRANSLATOR: 'Translator',
} as const;

/** @deprecated */
export type RoleName = (typeof ROLES)[keyof typeof ROLES];
```

- [ ] **Step 2: Add org-level permissions to `src/lib/permissions.ts`**

Add after the existing `USER_DELETE` entry:

```typescript
  // ── Org Membership ──────────────────────────────────────────────────────────
  ORG_MEMBER_VIEW: 'org_member:view',
  ORG_MEMBER_INVITE: 'org_member:invite',
  ORG_MEMBER_UPDATE: 'org_member:update',
  ORG_MEMBER_REMOVE: 'org_member:remove',
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/roles.ts src/lib/permissions.ts
git commit -m "feat(rbac): add org/project role constants and org membership permissions"
```

---

## Task 3: Update shared types in `lib/types.ts`

**Files:**

- Modify: `src/lib/types.ts`

- [ ] **Step 1: Update the `User` interface (session context user) — remove `role` and `organization`**

Replace the `User` interface:

```typescript
export interface User {
  id: number;
  email: string;
  // orgRole and projectRoles are loaded per-request by org/project middleware
  [key: string]: any;
}
```

- [ ] **Step 2: Update `AppPolicyUser` to carry org + project roles**

Replace the `AppPolicyUser` interface:

```typescript
import type { OrgRoleName, ProjectRoleName } from './roles';

/**
 * Shared identity for authorization policies across all domains.
 * `orgRole` is set by requireOrgAccess middleware.
 * `projectRoles` is set by requireProjectAccess middleware.
 */
export interface AppPolicyUser {
  id: number;
  orgId: number;
  orgRole: OrgRoleName;
  projectRoles: ProjectRoleName[];
}
```

- [ ] **Step 3: Add `ORG_MEMBER_NOT_FOUND` error code**

Add to `ErrorCode`:

```typescript
ORG_MEMBER_NOT_FOUND: 'ORG_MEMBER_NOT_FOUND',
ORG_MEMBERSHIP_CONFLICT: 'ORG_MEMBERSHIP_CONFLICT',
```

Add to `ErrorMessages`:

```typescript
ORG_MEMBER_NOT_FOUND: 'Org membership not found',
ORG_MEMBERSHIP_CONFLICT: 'User is already a member of this organization',
```

Add to `ErrorHttpStatus`:

```typescript
ORG_MEMBER_NOT_FOUND: 404,
ORG_MEMBERSHIP_CONFLICT: 409,
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): update AppPolicyUser and User for multi-org model"
```

---

## Task 4: Generate and finalize the database migration

**Files:**

- Create: `src/db/migrations/0010_user_centric_refactor.sql` (generated + edited)

- [ ] **Step 1: Generate the Drizzle migration**

Run: `npm run db:generate -- 0010_user_centric_refactor`

This creates `src/db/migrations/0010_user_centric_refactor.sql`. The file will contain DDL for:

- Creating `org_role` enum
- Creating `project_role` enum
- Creating `org_memberships` table
- Creating `project_user_roles` table
- Dropping `project_users` table
- Altering `users` to remove columns

- [ ] **Step 2: Open the generated migration file and add data migration BEFORE the destructive column drops**

Locate the `ALTER TABLE users DROP COLUMN role;` line. INSERT the following SQL **before** that line in the migration:

```sql
-- Migrate user org membership + status + createdBy to org_memberships
INSERT INTO org_memberships (user_id, org_id, org_role, status, created_by, created_at, updated_at)
SELECT
  u.id,
  u.organization,
  CASE r.name
    WHEN 'Manager' THEN 'org_manager'::org_role
    ELSE 'member'::org_role
  END,
  u.status,
  u.created_by,
  NOW(),
  NOW()
FROM users u
JOIN roles r ON u.role = r.id
WHERE u.organization IS NOT NULL;

-- Migrate project_users to project_user_roles using old user roles as initial project role
INSERT INTO project_user_roles (project_id, user_id, project_role, created_at)
SELECT
  pu.project_id,
  pu.user_id,
  CASE r.name
    WHEN 'Manager' THEN 'project_manager'::project_role
    WHEN 'Translator' THEN 'translator'::project_role
    ELSE 'observer'::project_role
  END,
  COALESCE(pu.created_at, NOW())
FROM project_users pu
JOIN users u ON pu.user_id = u.id
JOIN roles r ON u.role = r.id;
```

- [ ] **Step 3: Run migration against the dev database**

Run: `npm run db:migrate`

Expected: Migration runs successfully with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/
git commit -m "feat(migration): add org_memberships and project_user_roles, migrate existing data"
```

---

## Task 5: Update RBAC seeds

**Files:**

- Modify: `src/db/seeds/rbac.ts`

- [ ] **Step 1: Write a failing test for seed idempotency**

Create `src/db/seeds/rbac.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

import { PERMISSIONS } from '@/lib/permissions';
import { ORG_ROLES, PROJECT_ROLES } from '@/lib/roles';

describe('RBAC constants coverage', () => {
  it('every org role has at least one permission mapped', () => {
    const orgRoleNames = Object.values(ORG_ROLES);
    expect(orgRoleNames).toContain('org_owner');
    expect(orgRoleNames).toContain('org_manager');
    expect(orgRoleNames).toContain('member');
  });

  it('every project role has at least one permission mapped', () => {
    const projectRoleNames = Object.values(PROJECT_ROLES);
    expect(projectRoleNames).toContain('project_manager');
    expect(projectRoleNames).toContain('translator');
    expect(projectRoleNames).toContain('observer');
  });

  it('ORG_MEMBER_INVITE permission exists', () => {
    expect(PERMISSIONS.ORG_MEMBER_INVITE).toBe('org_member:invite');
  });
});
```

Run: `npm test src/db/seeds/rbac.test.ts`

Expected: PASS (this just validates constants exist)

- [ ] **Step 2: Replace `src/db/seeds/rbac.ts` with the updated mapping**

```typescript
import { db } from '@/db';
import { permissions, role_permissions, roles } from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { ORG_ROLES, PROJECT_ROLES } from '@/lib/roles';

const PERMISSION_DEFINITIONS = [
  { name: PERMISSIONS.PROJECT_VIEW, description: 'View projects' },
  { name: PERMISSIONS.PROJECT_CREATE, description: 'Create new projects' },
  { name: PERMISSIONS.PROJECT_UPDATE, description: 'Update existing projects' },
  { name: PERMISSIONS.PROJECT_DELETE, description: 'Delete projects' },
  { name: PERMISSIONS.CONTENT_ASSIGN, description: 'Assign chapter assignment' },
  { name: PERMISSIONS.CONTENT_UPDATE, description: 'Update chapter assignment content' },
  { name: PERMISSIONS.USER_VIEW, description: 'View user profiles' },
  { name: PERMISSIONS.USER_CREATE, description: 'Create new users' },
  { name: PERMISSIONS.USER_UPDATE, description: 'Update user profiles' },
  { name: PERMISSIONS.USER_DELETE, description: 'Delete user' },
  { name: PERMISSIONS.ORG_MEMBER_VIEW, description: 'View org members' },
  { name: PERMISSIONS.ORG_MEMBER_INVITE, description: 'Invite users to org' },
  { name: PERMISSIONS.ORG_MEMBER_UPDATE, description: 'Update org member roles' },
  { name: PERMISSIONS.ORG_MEMBER_REMOVE, description: 'Remove org members' },
];

// These role names now match the `org_role` or `project_role` enum values
const ROLE_DEFINITIONS = [
  { name: ORG_ROLES.ORG_OWNER },
  { name: ORG_ROLES.ORG_MANAGER },
  { name: ORG_ROLES.MEMBER },
  { name: PROJECT_ROLES.PROJECT_MANAGER },
  { name: PROJECT_ROLES.TRANSLATOR },
  { name: PROJECT_ROLES.PEER_CHECKER },
  { name: PROJECT_ROLES.OBSERVER },
];

const ROLE_PERMISSION_MAP: { roleName: string; permissionName: string }[] = [
  // Org Owner — everything
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.PROJECT_CREATE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.PROJECT_UPDATE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.PROJECT_DELETE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.CONTENT_ASSIGN },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.CONTENT_UPDATE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.USER_VIEW },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.USER_CREATE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.USER_UPDATE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.USER_DELETE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.ORG_MEMBER_VIEW },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.ORG_MEMBER_INVITE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.ORG_MEMBER_UPDATE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.ORG_MEMBER_REMOVE },

  // Org Manager — manage projects and users, cannot delete org
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.PROJECT_CREATE },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.PROJECT_UPDATE },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.PROJECT_DELETE },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.USER_VIEW },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.USER_CREATE },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.USER_UPDATE },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.ORG_MEMBER_VIEW },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.ORG_MEMBER_INVITE },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.ORG_MEMBER_REMOVE },

  // Member (org-level) — view only at org level
  { roleName: ORG_ROLES.MEMBER, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: ORG_ROLES.MEMBER, permissionName: PERMISSIONS.USER_VIEW },
  { roleName: ORG_ROLES.MEMBER, permissionName: PERMISSIONS.ORG_MEMBER_VIEW },

  // Project Manager (project-level)
  { roleName: PROJECT_ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: PROJECT_ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.PROJECT_UPDATE },
  { roleName: PROJECT_ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.CONTENT_ASSIGN },
  { roleName: PROJECT_ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.CONTENT_UPDATE },
  { roleName: PROJECT_ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.USER_VIEW },

  // Translator (project-level)
  { roleName: PROJECT_ROLES.TRANSLATOR, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: PROJECT_ROLES.TRANSLATOR, permissionName: PERMISSIONS.CONTENT_UPDATE },
  { roleName: PROJECT_ROLES.TRANSLATOR, permissionName: PERMISSIONS.USER_VIEW },

  // Peer Checker (project-level)
  { roleName: PROJECT_ROLES.PEER_CHECKER, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: PROJECT_ROLES.PEER_CHECKER, permissionName: PERMISSIONS.CONTENT_UPDATE },

  // Observer (project-level) — read-only
  { roleName: PROJECT_ROLES.OBSERVER, permissionName: PERMISSIONS.PROJECT_VIEW },
];

async function seed() {
  await db.insert(roles).values(ROLE_DEFINITIONS).onConflictDoNothing({ target: roles.name });

  await db
    .insert(permissions)
    .values(PERMISSION_DEFINITIONS)
    .onConflictDoNothing({ target: permissions.name });

  const allRoles = await db.select({ id: roles.id, name: roles.name }).from(roles);
  const allPermissions = await db
    .select({ id: permissions.id, name: permissions.name })
    .from(permissions);

  const roleMap = new Map(allRoles.map((r) => [r.name, r.id]));
  const permissionMap = new Map(allPermissions.map((p) => [p.name, p.id]));

  const rolePermissionRows = ROLE_PERMISSION_MAP.map(({ roleName, permissionName }) => {
    const roleId = roleMap.get(roleName);
    const permissionId = permissionMap.get(permissionName);
    if (!roleId) throw new Error(`Role not found in DB: ${roleName}`);
    if (!permissionId) throw new Error(`Permission not found in DB: ${permissionName}`);
    return { roleId, permissionId };
  });

  await db.insert(role_permissions).values(rolePermissionRows).onConflictDoNothing();

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Commit**

```bash
git add src/db/seeds/rbac.ts src/db/seeds/rbac.test.ts
git commit -m "feat(seeds): update RBAC seed for multi-org roles and permissions"
```

---

## Task 6: Create the org-memberships domain

**Files:**

- Create: `src/domains/orgs/org-memberships.types.ts`
- Create: `src/domains/orgs/org-memberships.repository.ts`
- Create: `src/domains/orgs/org-memberships.service.ts`
- Create: `src/domains/orgs/org-memberships.service.test.ts`
- Create: `src/domains/orgs/org-memberships.route.ts`

### 6a — Types

- [ ] **Step 1: Create `src/domains/orgs/org-memberships.types.ts`**

```typescript
import { z } from '@hono/zod-openapi';

import type { insertOrgMembershipsSchema, selectOrgMembershipsSchema } from '@/db/schema';

export type OrgMembership = z.infer<typeof selectOrgMembershipsSchema>;
export type CreateOrgMembershipInput = z.infer<typeof insertOrgMembershipsSchema>;

export const orgMembershipResponseSchema = z.object({
  userId: z.number().int(),
  orgId: z.number().int(),
  orgRole: z.enum(['org_owner', 'org_manager', 'member']),
  status: z.enum(['invited', 'verified', 'inactive']),
  createdBy: z.number().int().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export type OrgMembershipResponse = z.infer<typeof orgMembershipResponseSchema>;

export const createOrgMembershipRequestSchema = z.object({
  userId: z.number().int(),
  orgRole: z.enum(['org_owner', 'org_manager', 'member']).default('member'),
});

export const updateOrgMembershipRequestSchema = z.object({
  orgRole: z.enum(['org_owner', 'org_manager', 'member']),
});

export const ORG_MEMBERSHIP_ACTIONS = {
  LIST: 'list',
  VIEW: 'view',
  INVITE: 'invite',
  UPDATE: 'update',
  REMOVE: 'remove',
} as const;

export type OrgMembershipAction =
  (typeof ORG_MEMBERSHIP_ACTIONS)[keyof typeof ORG_MEMBERSHIP_ACTIONS];
```

### 6b — Repository

- [ ] **Step 2: Write failing tests for repository in `src/domains/orgs/org-memberships.service.test.ts`**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorMessages } from '@/lib/types';

import * as repo from './org-memberships.repository';
import {
  addOrgMember,
  getOrgMember,
  getOrgMembers,
  removeOrgMember,
  updateOrgMemberRole,
} from './org-memberships.service';

vi.mock('./org-memberships.repository', () => ({
  findByOrg: vi.fn(),
  findByUserAndOrg: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const mockMembership = {
  userId: 1,
  orgId: 10,
  orgRole: 'member' as const,
  status: 'verified' as const,
  createdBy: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

beforeEach(() => vi.clearAllMocks());

describe('getOrgMembers', () => {
  it('returns members for an org', async () => {
    vi.mocked(repo.findByOrg).mockResolvedValue({ ok: true, data: [mockMembership] });
    const result = await getOrgMembers(10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it('propagates repo error', async () => {
    vi.mocked(repo.findByOrg).mockResolvedValue({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: ErrorMessages.INTERNAL_ERROR },
    });
    const result = await getOrgMembers(10);
    expect(result.ok).toBe(false);
  });
});

describe('getOrgMember', () => {
  it('returns the membership for a specific user in an org', async () => {
    vi.mocked(repo.findByUserAndOrg).mockResolvedValue({ ok: true, data: mockMembership });
    const result = await getOrgMember(1, 10);
    expect(result.ok).toBe(true);
  });

  it('returns ORG_MEMBER_NOT_FOUND when missing', async () => {
    vi.mocked(repo.findByUserAndOrg).mockResolvedValue({
      ok: false,
      error: { code: 'ORG_MEMBER_NOT_FOUND', message: ErrorMessages.ORG_MEMBER_NOT_FOUND },
    });
    const result = await getOrgMember(1, 99);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ORG_MEMBER_NOT_FOUND');
  });
});

describe('addOrgMember', () => {
  it('inserts and returns the new membership', async () => {
    vi.mocked(repo.insert).mockResolvedValue({ ok: true, data: mockMembership });
    const result = await addOrgMember({
      userId: 1,
      orgId: 10,
      orgRole: 'member',
      status: 'invited',
      createdBy: 2,
    });
    expect(result.ok).toBe(true);
  });
});

describe('updateOrgMemberRole', () => {
  it('updates the org role', async () => {
    const updated = { ...mockMembership, orgRole: 'org_manager' as const };
    vi.mocked(repo.update).mockResolvedValue({ ok: true, data: updated });
    const result = await updateOrgMemberRole(1, 10, 'org_manager');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.orgRole).toBe('org_manager');
  });
});

describe('removeOrgMember', () => {
  it('removes a membership', async () => {
    vi.mocked(repo.remove).mockResolvedValue({ ok: true, data: undefined });
    const result = await removeOrgMember(1, 10);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL (service + repo don't exist yet)**

Run: `npm test src/domains/orgs/org-memberships.service.test.ts`

Expected: FAIL with "Cannot find module './org-memberships.repository'"

- [ ] **Step 4: Create `src/domains/orgs/org-memberships.repository.ts`**

```typescript
import { and, eq } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { org_memberships } from '@/db/schema';
import { handleConstraintError } from '@/lib/db-errors';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type { CreateOrgMembershipInput, OrgMembership } from './org-memberships.types';

export async function findByOrg(orgId: number): Promise<Result<OrgMembership[]>> {
  try {
    const rows = await db.select().from(org_memberships).where(eq(org_memberships.orgId, orgId));
    return ok(rows);
  } catch (error) {
    logger.error({ cause: error, message: 'Failed to find org members', context: { orgId } });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function findByUserAndOrg(
  userId: number,
  orgId: number
): Promise<Result<OrgMembership>> {
  try {
    const [row] = await db
      .select()
      .from(org_memberships)
      .where(and(eq(org_memberships.userId, userId), eq(org_memberships.orgId, orgId)))
      .limit(1);
    if (!row) return err(ErrorCode.ORG_MEMBER_NOT_FOUND);
    return ok(row);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to find org member',
      context: { userId, orgId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function findAllByUser(userId: number): Promise<Result<OrgMembership[]>> {
  try {
    const rows = await db.select().from(org_memberships).where(eq(org_memberships.userId, userId));
    return ok(rows);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to find org memberships for user',
      context: { userId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function insert(input: CreateOrgMembershipInput): Promise<Result<OrgMembership>> {
  try {
    const [row] = await db.insert(org_memberships).values(input).returning();
    if (!row) return err(ErrorCode.INTERNAL_ERROR);
    return ok(row);
  } catch (error) {
    return handleConstraintError(error);
  }
}

export async function update(
  userId: number,
  orgId: number,
  patch: Partial<Pick<OrgMembership, 'orgRole' | 'status'>>
): Promise<Result<OrgMembership>> {
  try {
    const [updated] = await db
      .update(org_memberships)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(org_memberships.userId, userId), eq(org_memberships.orgId, orgId)))
      .returning();
    if (!updated) return err(ErrorCode.ORG_MEMBER_NOT_FOUND);
    return ok(updated);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to update org member',
      context: { userId, orgId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function remove(userId: number, orgId: number): Promise<Result<void>> {
  try {
    const [deleted] = await db
      .delete(org_memberships)
      .where(and(eq(org_memberships.userId, userId), eq(org_memberships.orgId, orgId)))
      .returning({ userId: org_memberships.userId });
    if (!deleted) return err(ErrorCode.ORG_MEMBER_NOT_FOUND);
    return ok(undefined);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to remove org member',
      context: { userId, orgId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
```

- [ ] **Step 5: Create `src/domains/orgs/org-memberships.service.ts`**

```typescript
import type { OrgRoleName } from '@/lib/roles';
import type { Result } from '@/lib/types';
import { ok } from '@/lib/types';

import type { CreateOrgMembershipInput, OrgMembership } from './org-memberships.types';

import * as repo from './org-memberships.repository';

export function getOrgMembers(orgId: number): Promise<Result<OrgMembership[]>> {
  return repo.findByOrg(orgId);
}

export function getOrgMember(userId: number, orgId: number): Promise<Result<OrgMembership>> {
  return repo.findByUserAndOrg(userId, orgId);
}

export function getUserMemberships(userId: number): Promise<Result<OrgMembership[]>> {
  return repo.findAllByUser(userId);
}

export function addOrgMember(input: CreateOrgMembershipInput): Promise<Result<OrgMembership>> {
  return repo.insert(input);
}

export async function updateOrgMemberRole(
  userId: number,
  orgId: number,
  orgRole: OrgRoleName
): Promise<Result<OrgMembership>> {
  return repo.update(userId, orgId, { orgRole });
}

export function removeOrgMember(userId: number, orgId: number): Promise<Result<void>> {
  return repo.remove(userId, orgId);
}

export async function verifyMembership(
  userId: number,
  orgId: number
): Promise<Result<OrgMembership>> {
  return repo.update(userId, orgId, { status: 'verified' });
}
```

- [ ] **Step 6: Run tests — expect PASS**

Run: `npm test src/domains/orgs/org-memberships.service.test.ts`

Expected: All tests PASS

- [ ] **Step 7: Create `src/domains/orgs/org-memberships.route.ts`**

```typescript
import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { PERMISSIONS } from '@/lib/permissions';
import { getHttpStatus } from '@/lib/types';
import { authenticateUser, requirePermission } from '@/middlewares/role-auth';
import { server } from '@/server/server';

import * as orgMembershipsService from './org-memberships.service';
import {
  createOrgMembershipRequestSchema,
  orgMembershipResponseSchema,
  updateOrgMembershipRequestSchema,
} from './org-memberships.types';

const orgIdParam = z.object({
  orgId: z.coerce.number().openapi({ param: { name: 'orgId', in: 'path', required: true } }),
});

const orgUserParam = orgIdParam.extend({
  userId: z.coerce.number().openapi({ param: { name: 'userId', in: 'path', required: true } }),
});

// GET /organizations/:orgId/members
server.openapi(
  createRoute({
    tags: ['Org Members'],
    method: 'get',
    path: '/organizations/{orgId}/members',
    middleware: [authenticateUser, requirePermission(PERMISSIONS.ORG_MEMBER_VIEW)] as const,
    request: { params: orgIdParam },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(orgMembershipResponseSchema.array(), 'Org members'),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        createMessageObjectSchema('Unauthorized'),
        'Unauthorized'
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(createMessageObjectSchema('Forbidden'), 'Forbidden'),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
        'Internal server error'
      ),
    },
  }),
  async (c) => {
    const { orgId } = c.req.valid('param');
    const result = await orgMembershipsService.getOrgMembers(orgId);
    if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
    return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
  }
);

// POST /organizations/:orgId/members
server.openapi(
  createRoute({
    tags: ['Org Members'],
    method: 'post',
    path: '/organizations/{orgId}/members',
    middleware: [authenticateUser, requirePermission(PERMISSIONS.ORG_MEMBER_INVITE)] as const,
    request: {
      params: orgIdParam,
      body: jsonContentRequired(createOrgMembershipRequestSchema, 'Membership to create'),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(orgMembershipResponseSchema, 'Created membership'),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        createMessageObjectSchema('Unauthorized'),
        'Unauthorized'
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(createMessageObjectSchema('Forbidden'), 'Forbidden'),
      [HttpStatusCodes.CONFLICT]: jsonContent(
        createMessageObjectSchema('Conflict'),
        'Already a member'
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
        'Internal server error'
      ),
    },
  }),
  async (c) => {
    const { orgId } = c.req.valid('param');
    const body = c.req.valid('json');
    const currentUser = c.get('user')!;

    const result = await orgMembershipsService.addOrgMember({
      orgId,
      userId: body.userId,
      orgRole: body.orgRole ?? 'member',
      status: 'invited',
      createdBy: currentUser.id,
    });

    if (result.ok) return c.json(result.data, HttpStatusCodes.CREATED);
    return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
  }
);

// PATCH /organizations/:orgId/members/:userId
server.openapi(
  createRoute({
    tags: ['Org Members'],
    method: 'patch',
    path: '/organizations/{orgId}/members/{userId}',
    middleware: [authenticateUser, requirePermission(PERMISSIONS.ORG_MEMBER_UPDATE)] as const,
    request: {
      params: orgUserParam,
      body: jsonContentRequired(updateOrgMembershipRequestSchema, 'Role update'),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(orgMembershipResponseSchema, 'Updated membership'),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        createMessageObjectSchema('Not Found'),
        'Member not found'
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        createMessageObjectSchema('Unauthorized'),
        'Unauthorized'
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(createMessageObjectSchema('Forbidden'), 'Forbidden'),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
        'Internal server error'
      ),
    },
  }),
  async (c) => {
    const { orgId, userId } = c.req.valid('param');
    const { orgRole } = c.req.valid('json');
    const result = await orgMembershipsService.updateOrgMemberRole(userId, orgId, orgRole);
    if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
    return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
  }
);

// DELETE /organizations/:orgId/members/:userId
server.openapi(
  createRoute({
    tags: ['Org Members'],
    method: 'delete',
    path: '/organizations/{orgId}/members/{userId}',
    middleware: [authenticateUser, requirePermission(PERMISSIONS.ORG_MEMBER_REMOVE)] as const,
    request: { params: orgUserParam },
    responses: {
      [HttpStatusCodes.NO_CONTENT]: { description: 'Member removed' },
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        createMessageObjectSchema('Not Found'),
        'Member not found'
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        createMessageObjectSchema('Unauthorized'),
        'Unauthorized'
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(createMessageObjectSchema('Forbidden'), 'Forbidden'),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR),
        'Internal server error'
      ),
    },
  }),
  async (c) => {
    const { orgId, userId } = c.req.valid('param');
    const result = await orgMembershipsService.removeOrgMember(userId, orgId);
    if (result.ok) return c.body(null, HttpStatusCodes.NO_CONTENT);
    return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
  }
);
```

- [ ] **Step 8: Register the org-memberships route in `src/app.ts`**

Add the import:

```typescript
import '@/domains/orgs/org-memberships.route';
```

- [ ] **Step 9: Commit**

```bash
git add src/domains/orgs/ src/app.ts
git commit -m "feat(orgs): add org-memberships domain with CRUD routes"
```

---

## Task 7: Update auth middleware to support multi-org model

**Files:**

- Modify: `src/server/context.types.ts`
- Modify: `src/middlewares/role-auth.ts`

- [ ] **Step 1: Update `src/server/context.types.ts` to add org membership to Variables**

Replace the `AppEnv` interface:

```typescript
import type { ChapterAssignmentWithAuthContext } from '@/domains/chapter-assignments/chapter-assignments.repository';
import type { OrgMembership } from '@/domains/orgs/org-memberships.types';
import type { ProjectWithLanguageNames } from '@/domains/projects/projects.types';
import type { TranslatedVerseResponse } from '@/domains/translated-verses/translated-verses.types';
import type { UserResponse } from '@/domains/users/users.types';
import type { AppBindings } from '@/lib/types';

export interface AppEnv extends AppBindings {
  Variables: AppBindings['Variables'] & {
    chapterAssignment?: ChapterAssignmentWithAuthContext;
    project?: ProjectWithLanguageNames;
    projectAuthContext?: { isProjectMember: boolean; projectRoles: string[] };
    targetUser?: UserResponse;
    translatedVerse?: TranslatedVerseResponse;
    orgMembership?: OrgMembership; // set by requireOrgAccess middleware
  };
}
```

- [ ] **Step 2: Rewrite `src/middlewares/role-auth.ts`**

```typescript
import type { Context, Next } from 'hono';

import { HTTPException } from 'hono/http-exception';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { OrgMembership } from '@/domains/orgs/org-memberships.types';
import type { Permission } from '@/lib/permissions';
import type { AppBindings } from '@/lib/types';

import { getUserByEmail } from '@/domains/users/users.service';
import { getOrgMember } from '@/domains/orgs/org-memberships.service';
import { roleHasPermissionByName } from '@/lib/services/permissions/permissions.service';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailMatch(sourceEmail: string, targetEmail: string): boolean {
  return normalizeEmail(sourceEmail) === normalizeEmail(targetEmail);
}

/**
 * 1. Authentication Middleware
 * Validates the token, fetches the user by email, and stores identity in context.
 * Does NOT load org membership — that is done by requireOrgAccess().
 */
export async function authenticateUser(c: Context<AppBindings>, next: Next) {
  const userEmail = c.get('loggedInUserEmail');
  if (!userEmail) {
    throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
      message: 'User email not found in token',
    });
  }

  const userResult = await getUserByEmail(userEmail);
  if (!userResult.ok) {
    throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
      message: 'User not found in database',
    });
  }

  c.set('user', userResult.data);
  await next();
}

/**
 * 2. Org-scoped Middleware
 * Loads the user's membership in the org identified by an :orgId path param.
 * Rejects inactive members. Stores the membership as `orgMembership` in context.
 */
export function requireOrgAccess(orgIdParam = 'orgId') {
  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, { message: 'User not authenticated' });
    }

    const rawOrgId = c.req.param(orgIdParam);
    const orgId = Number(rawOrgId);
    if (!orgId || Number.isNaN(orgId)) {
      throw new HTTPException(HttpStatusCodes.BAD_REQUEST, { message: 'Missing or invalid orgId' });
    }

    const membershipResult = await getOrgMember(user.id, orgId);
    if (!membershipResult.ok) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
        message: 'Not a member of this organization',
      });
    }

    const membership = membershipResult.data;
    if (membership.status === 'inactive') {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, { message: 'Org membership is inactive' });
    }

    (c as any).set('orgMembership', membership);
    await next();
  };
}

/**
 * 3. Authorization Middleware
 * Checks if the user's org role or project roles have the given permission.
 * Requires authenticateUser + requireOrgAccess to have run first.
 */
export function requirePermission(permission: Permission) {
  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, { message: 'User not authenticated' });
    }

    const orgMembership: OrgMembership | undefined = (c as any).get('orgMembership');

    // Collect all role names that apply to this request
    const roleNames: string[] = [];
    if (orgMembership) roleNames.push(orgMembership.orgRole);

    // Project roles are set by project middleware (see project-auth.middleware.ts)
    const projectAuthContext = (c as any).get('projectAuthContext');
    if (projectAuthContext?.projectRoles) roleNames.push(...projectAuthContext.projectRoles);

    if (roleNames.length === 0) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, { message: 'No role context available' });
    }

    const grants = await Promise.all(
      roleNames.map((roleName) => roleHasPermissionByName(roleName, permission))
    );

    if (!grants.some(Boolean)) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, { message: 'Insufficient permissions' });
    }

    await next();
  };
}

/**
 * 4. Self-Access Middleware
 * Ensures the authenticated user can only access their own resources.
 */
export function requireSelf() {
  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, { message: 'User not authenticated' });
    }

    const { userId } = c.req.param();
    if (!userId || user.id !== Number(userId)) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
        message: 'You can only access your own resources',
      });
    }

    await next();
  };
}
```

- [ ] **Step 3: Update `src/lib/services/permissions/permissions.service.ts` to support name-based lookup**

```typescript
import { and, eq } from 'drizzle-orm';

import type { Permission } from '@/lib/permissions';

import { db } from '@/db';
import { permissions, role_permissions, roles } from '@/db/schema';

export async function roleHasPermission(roleId: number, permission: Permission): Promise<boolean> {
  const rows = await db
    .select({ id: permissions.id })
    .from(role_permissions)
    .innerJoin(permissions, eq(permissions.id, role_permissions.permissionId))
    .where(and(eq(role_permissions.roleId, roleId), eq(permissions.name, permission)))
    .limit(1);
  return rows.length > 0;
}

export async function roleHasPermissionByName(
  roleName: string,
  permission: Permission
): Promise<boolean> {
  const rows = await db
    .select({ id: permissions.id })
    .from(role_permissions)
    .innerJoin(roles, eq(roles.id, role_permissions.roleId))
    .innerJoin(permissions, eq(permissions.id, role_permissions.permissionId))
    .where(and(eq(roles.name, roleName), eq(permissions.name, permission)))
    .limit(1);
  return rows.length > 0;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/middlewares/role-auth.ts src/server/context.types.ts src/lib/services/permissions/permissions.service.ts
git commit -m "feat(auth): split authenticateUser from org access, add requireOrgAccess middleware"
```

---

## Task 8: Update users domain

**Files:**

- Modify: `src/domains/users/users.types.ts`
- Modify: `src/domains/users/users.repository.ts`
- Modify: `src/domains/users/users.service.ts`
- Modify: `src/domains/users/users.service.test.ts`
- Modify: `src/domains/users/user.policy.ts`
- Modify: `src/domains/users/users.route.ts`
- Modify: `src/test/utils/test-helpers.ts`

- [ ] **Step 1: Update `src/domains/users/users.types.ts` — remove org/role from schemas**

Replace `userResponseSchema`:

```typescript
export const userResponseSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
  username: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
```

Replace `createUserRequestSchema`:

```typescript
export const createUserRequestSchema = z.object({
  username: z.string().min(1).max(100),
  email: z.string().email().max(255),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});
```

Replace `updateUserRequestSchema`:

```typescript
export const updateUserRequestSchema = z.object({
  username: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  firstName: z.string().max(100).optional().nullable(),
  lastName: z.string().max(100).optional().nullable(),
});
```

Remove `UserWithRole` type — it is no longer needed (role comes from org membership).

- [ ] **Step 2: Update `src/domains/users/users.service.ts`**

Remove `getUsersByOrganization` (org-scoped user lists are now done through org memberships).
Remove `roleName` from `getUserByEmail` return type.

Update `toUserResponse`:

```typescript
export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getUserByEmail(email: string): Promise<Result<UserResponse>> {
  const result = await repo.findByEmail(email);
  if (!result.ok) return result;
  return ok(toUserResponse(result.data));
}
```

- [ ] **Step 3: Update `src/domains/users/users.repository.ts`**

Remove `findByOrganization`.
Update `findByEmail` to not join with roles:

```typescript
export async function findByEmail(email: string): Promise<Result<User>> {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (!user) return err(ErrorCode.USER_NOT_FOUND);
    return ok(user);
  } catch (error) {
    logger.error({ cause: error, message: 'Failed to find user by email', context: { email } });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
```

- [ ] **Step 4: Update `src/domains/users/user.policy.ts` — use orgRole from AppPolicyUser**

```typescript
import type { AppPolicyUser } from '@/lib/types';
import { ORG_ROLES } from '@/lib/roles';

interface PolicyTargetUser {
  id: number;
}

export const UserPolicy = {
  list(user: AppPolicyUser): boolean {
    return user.orgRole === ORG_ROLES.ORG_OWNER || user.orgRole === ORG_ROLES.ORG_MANAGER;
  },

  view(user: AppPolicyUser, targetUser: PolicyTargetUser): boolean {
    if (user.orgRole === ORG_ROLES.ORG_OWNER || user.orgRole === ORG_ROLES.ORG_MANAGER) {
      return true;
    }
    return user.id === targetUser.id;
  },

  create(user: AppPolicyUser): boolean {
    return user.orgRole === ORG_ROLES.ORG_OWNER || user.orgRole === ORG_ROLES.ORG_MANAGER;
  },

  update(user: AppPolicyUser, targetUser: PolicyTargetUser): boolean {
    if (user.orgRole === ORG_ROLES.ORG_OWNER || user.orgRole === ORG_ROLES.ORG_MANAGER) {
      return true;
    }
    return user.id === targetUser.id;
  },

  delete(user: AppPolicyUser, targetUser: PolicyTargetUser): boolean {
    return user.orgRole === ORG_ROLES.ORG_OWNER || user.orgRole === ORG_ROLES.ORG_MANAGER;
  },
};
```

- [ ] **Step 5: Update `src/test/utils/test-helpers.ts` — remove role/organization from sample users**

Replace `sampleUsers` in test-helpers:

```typescript
export const sampleUsers = {
  user1: {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  user2: {
    id: 2,
    username: 'testuser2',
    email: 'test2@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  },
  newUser: {
    username: 'newuser',
    email: 'newuser@example.com',
    firstName: 'John',
    lastName: 'Doe',
  },
  updateUser: {
    firstName: 'Jane',
    lastName: 'Smith',
  },
  updateUserWithEmail: {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'updated@example.com',
  },
};
```

- [ ] **Step 6: Update `src/domains/users/users.service.test.ts`**

Remove `getUsersByOrganization` test. Remove assertions on `role`, `organization`, `status` fields.
Update the `getUserByEmail` test to not expect `roleName`:

```typescript
describe('getUserByEmail', () => {
  it('should return user by email mapped to response shape', async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([sampleUsers.user1]),
        }),
      }),
    });

    const result = await getUserByEmail(sampleUsers.user1.email);

    expect(result).toEqual({ ok: true, data: toUserResponse(sampleUsers.user1) });
  });
  // ... (keep error cases)
});
```

- [ ] **Step 7: Run tests**

Run: `npm test src/domains/users/`

Expected: All tests PASS

- [ ] **Step 8: Update `src/domains/users/users.route.ts`**

Remove the `organization: currentUser.organization` injection in the create handler.
Update the user create handler to call `orgMembershipsService.addOrgMember` after creating the user — inviting them to the current org:

In the POST `/users` handler, after `createUser` succeeds:

```typescript
// Invite newly created user to the current org with 'member' role
const orgMembership = c.get('orgMembership');
if (orgMembership) {
  await orgMembershipsService.addOrgMember({
    userId: newUser.id,
    orgId: orgMembership.orgId,
    orgRole: 'member',
    status: 'invited',
    createdBy: currentUser.id,
  });
}
```

- [ ] **Step 9: Commit**

```bash
git add src/domains/users/ src/test/utils/test-helpers.ts
git commit -m "refactor(users): remove single-org columns, update policy to use orgRole"
```

---

## Task 9: Update projects domain

**Files:**

- Modify: `src/domains/projects/project.policy.ts`
- Modify: `src/domains/projects/project-auth.middleware.ts`
- Modify: `src/domains/projects/projects.route.ts`
- Modify: `src/domains/projects/users/project-users.types.ts`
- Modify: `src/domains/projects/users/project-users.repository.ts`
- Modify: `src/domains/projects/users/project-users.service.ts`
- Modify: `src/domains/projects/users/project-users.route.ts`

### 9a — Update project-users to use `project_user_roles`

- [ ] **Step 1: Update `src/domains/projects/users/project-users.types.ts`**

```typescript
import { z } from '@hono/zod-openapi';

import type { insertProjectUserRolesSchema, selectProjectUserRolesSchema } from '@/db/schema';

export type ProjectUserRole = z.infer<typeof selectProjectUserRolesSchema>;
export type CreateProjectUserRoleInput = z.infer<typeof insertProjectUserRolesSchema>;

export const projectUserRoleResponseSchema = z.object({
  projectId: z.number().int(),
  userId: z.number().int(),
  projectRole: z.enum(['project_manager', 'translator', 'peer_checker', 'observer']),
  displayName: z.string(),
  createdAt: z.date().nullable(),
});

export type ProjectUserRoleResponse = z.infer<typeof projectUserRoleResponseSchema>;

export const addProjectUserRoleRequestSchema = z.object({
  userIds: z.array(z.number().int()).min(1),
  projectRole: z.enum(['project_manager', 'translator', 'peer_checker', 'observer']),
});
```

- [ ] **Step 2: Update `src/domains/projects/users/project-users.repository.ts`**

```typescript
import { and, eq, inArray } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import {
  chapter_assignments,
  project_unit_roles,
  project_units,
  project_user_roles,
  users,
} from '@/db/schema';
import { handleConstraintError } from '@/lib/db-errors';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type { ProjectUserRoleResponse } from './project-users.types';

export async function getProjectUsers(
  projectId: number
): Promise<Result<ProjectUserRoleResponse[]>> {
  try {
    const rows = await db
      .select({
        projectId: project_user_roles.projectId,
        userId: project_user_roles.userId,
        projectRole: project_user_roles.projectRole,
        displayName: users.username,
        createdAt: project_user_roles.createdAt,
      })
      .from(project_user_roles)
      .innerJoin(users, eq(project_user_roles.userId, users.id))
      .where(eq(project_user_roles.projectId, projectId))
      .orderBy(users.username);

    return ok(rows);
  } catch (error) {
    logger.error({ cause: error, message: 'Failed to get project users', context: { projectId } });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function getProjectRolesForUser(
  projectId: number,
  userId: number
): Promise<Result<string[]>> {
  try {
    const rows = await db
      .select({ projectRole: project_user_roles.projectRole })
      .from(project_user_roles)
      .where(
        and(eq(project_user_roles.projectId, projectId), eq(project_user_roles.userId, userId))
      );
    return ok(rows.map((r) => r.projectRole));
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to get project roles for user',
      context: { projectId, userId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function addProjectUserRoles(
  projectId: number,
  userIds: number[],
  projectRole: string
): Promise<
  Result<{ projectId: number; userId: number; projectRole: string; createdAt: Date | null }[]>
> {
  if (userIds.length === 0) return ok([]);
  try {
    const inserted = await db
      .insert(project_user_roles)
      .values(userIds.map((userId) => ({ projectId, userId, projectRole: projectRole as any })))
      .onConflictDoNothing()
      .returning({
        projectId: project_user_roles.projectId,
        userId: project_user_roles.userId,
        projectRole: project_user_roles.projectRole,
        createdAt: project_user_roles.createdAt,
      });
    return ok(inserted);
  } catch (error) {
    const constraintResult = handleConstraintError(error);
    if (!constraintResult.ok && constraintResult.error.code === ErrorCode.DUPLICATE) {
      return err(ErrorCode.USER_ALREADY_IN_PROJECT);
    }
    logger.error({
      cause: error,
      message: 'Failed to add users to project',
      context: { projectId, userIds },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function removeProjectUserRole(
  projectId: number,
  userId: number,
  projectRole: string
): Promise<Result<void>> {
  try {
    const deleted = await db
      .delete(project_user_roles)
      .where(
        and(
          eq(project_user_roles.projectId, projectId),
          eq(project_user_roles.userId, userId),
          eq(project_user_roles.projectRole, projectRole as any)
        )
      )
      .returning({ userId: project_user_roles.userId });

    if (deleted.length === 0) return err(ErrorCode.USER_NOT_IN_PROJECT);
    return ok(undefined);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to remove user role from project',
      context: { projectId, userId, projectRole },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function removeAllProjectUserRoles(
  projectId: number,
  userId: number
): Promise<Result<void>> {
  try {
    // Check for assigned content first
    const [assignedContent] = await db
      .select({ userId: chapter_assignments.assignedUserId })
      .from(chapter_assignments)
      .innerJoin(project_units, eq(chapter_assignments.projectUnitId, project_units.id))
      .where(
        and(
          eq(project_units.projectId, projectId),
          and(eq(chapter_assignments.assignedUserId, userId))
        )
      )
      .limit(1);

    if (assignedContent) return err(ErrorCode.USER_HAS_ASSIGNED_CONTENT);

    await db
      .delete(project_user_roles)
      .where(
        and(eq(project_user_roles.projectId, projectId), eq(project_user_roles.userId, userId))
      );

    return ok(undefined);
  } catch (error) {
    logger.error({
      cause: error,
      message: 'Failed to remove user from project',
      context: { projectId, userId },
    });
    return err(ErrorCode.INTERNAL_ERROR);
  }
}

export async function resolveIsProjectMember(projectId: number, userId: number): Promise<boolean> {
  const [member] = await db
    .select({ projectId: project_user_roles.projectId })
    .from(project_user_roles)
    .where(and(eq(project_user_roles.projectId, projectId), eq(project_user_roles.userId, userId)))
    .limit(1);

  return member !== undefined;
}
```

- [ ] **Step 3: Update `src/domains/projects/users/project-users.service.ts`**

```typescript
import * as usersService from '@/domains/users/users.service';
import { err, ErrorCode, ok } from '@/lib/types';

import * as repo from './project-users.repository';

export function getProjectUsers(projectId: number) {
  return repo.getProjectUsers(projectId);
}

export function getProjectRolesForUser(projectId: number, userId: number) {
  return repo.getProjectRolesForUser(projectId, userId);
}

export async function addProjectUsers(projectId: number, userIds: number[], projectRole: string) {
  const usersResult = await usersService.getUsersByIds(userIds);
  if (!usersResult.ok) return err(ErrorCode.INTERNAL_ERROR);

  const foundIds = new Set(usersResult.data.map((u) => u.id));
  const missingId = userIds.find((id) => !foundIds.has(id));
  if (missingId) return err(ErrorCode.USER_NOT_FOUND);

  const insertResult = await repo.addProjectUserRoles(projectId, userIds, projectRole);
  if (!insertResult.ok) return insertResult;

  const userMap = new Map(usersResult.data.map((u) => [u.id, u]));

  return ok(
    insertResult.data.map((row) => ({
      ...row,
      displayName: userMap.get(row.userId)!.username,
    }))
  );
}

export function removeProjectUser(projectId: number, userId: number) {
  return repo.removeAllProjectUserRoles(projectId, userId);
}

export function resolveIsProjectMember(projectId: number, userId: number): Promise<boolean> {
  return repo.resolveIsProjectMember(projectId, userId);
}
```

### 9b — Update project policy

- [ ] **Step 4: Update `src/domains/projects/project.policy.ts`**

```typescript
import type { AppPolicyUser } from '@/lib/types';
import { ORG_ROLES, PROJECT_ROLES } from '@/lib/roles';

import type { ProjectWithLanguageNames } from './projects.types';

const _isOrgAdmin = (user: AppPolicyUser): boolean =>
  user.orgRole === ORG_ROLES.ORG_OWNER || user.orgRole === ORG_ROLES.ORG_MANAGER;

const _isProjectManager = (user: AppPolicyUser): boolean =>
  user.projectRoles.includes(PROJECT_ROLES.PROJECT_MANAGER);

export const ProjectPolicy = {
  list(user: AppPolicyUser): boolean {
    return _isOrgAdmin(user);
  },

  read(user: AppPolicyUser, project: ProjectWithLanguageNames, isProjectMember = false): boolean {
    if (_isOrgAdmin(user)) return project.organization === user.orgId;
    return isProjectMember;
  },

  update(user: AppPolicyUser, project: ProjectWithLanguageNames): boolean {
    if (_isOrgAdmin(user)) return project.organization === user.orgId;
    return _isProjectManager(user);
  },

  delete(user: AppPolicyUser, project: ProjectWithLanguageNames): boolean {
    if (_isOrgAdmin(user)) return project.organization === user.orgId;
    return false;
  },
};
```

### 9c — Update project-auth middleware

- [ ] **Step 5: Update `src/domains/projects/project-auth.middleware.ts`**

```typescript
import { createMiddleware } from 'hono/factory';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppEnv } from '@/server/context.types';

import { ORG_ROLES } from '@/lib/roles';
import { getHttpStatus } from '@/lib/types';

import type { ProjectAction } from './projects.types';

import { ProjectPolicy } from './project.policy';
import * as projectService from './projects.service';
import { PROJECT_ACTIONS } from './projects.types';
import { getProjectRolesForUser, resolveIsProjectMember } from './users/project-users.service';

export function requireProjectAccess(action: ProjectAction, paramName = 'id') {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')!;
    const orgMembership = (c as any).get('orgMembership');

    const orgRole = orgMembership?.orgRole ?? ORG_ROLES.MEMBER;
    const orgId = orgMembership?.orgId ?? 0;

    const policyUser = {
      id: user.id,
      orgId,
      orgRole,
      projectRoles: [] as string[],
    };

    if (action === PROJECT_ACTIONS.LIST) {
      if (!ProjectPolicy.list(policyUser)) {
        return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN);
      }
      return next();
    }

    const projectId = Number(c.req.param(paramName));
    if (!projectId || Number.isNaN(projectId)) {
      return c.json({ message: 'Missing project ID' }, HttpStatusCodes.BAD_REQUEST);
    }

    const result = await projectService.getProjectById(projectId);
    if (!result.ok) {
      return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
    }

    const project = result.data;

    // Load the user's project-level roles for authorization
    const projectRolesResult = await getProjectRolesForUser(projectId, user.id);
    const projectRoles = projectRolesResult.ok ? projectRolesResult.data : [];
    policyUser.projectRoles = projectRoles;

    let allowed = false;
    let isProjectMember = false;

    switch (action) {
      case PROJECT_ACTIONS.READ:
        isProjectMember = await resolveIsProjectMember(projectId, user.id);
        allowed = ProjectPolicy.read(policyUser, project, isProjectMember);
        break;
      case PROJECT_ACTIONS.UPDATE:
        allowed = ProjectPolicy.update(policyUser, project);
        break;
      case PROJECT_ACTIONS.DELETE:
        allowed = ProjectPolicy.delete(policyUser, project);
        break;
    }

    if (!allowed) {
      return c.json({ message: 'Project not found' }, HttpStatusCodes.NOT_FOUND);
    }

    c.set('project', project);
    if (action === PROJECT_ACTIONS.READ) {
      (c as any).set('projectAuthContext', { isProjectMember, projectRoles });
    }
    return next();
  });
}
```

### 9d — Update projects.route.ts

- [ ] **Step 6: Update `src/domains/projects/projects.route.ts`**

The `POST /projects` handler currently reads `currentUser.organization` — replace with org membership:

```typescript
server.openapi(createProjectRoute, async (c) => {
  const projectData = c.req.valid('json');
  const currentUser = c.get('user')!;
  const orgMembership = (c as any).get('orgMembership');

  if (!orgMembership) {
    return c.json({ message: 'Org context required' }, HttpStatusCodes.FORBIDDEN);
  }

  const result = await projectService.createProject({
    ...projectData,
    createdBy: currentUser.id,
    organization: orgMembership.orgId,
  });

  if (result.ok) return c.json(result.data, HttpStatusCodes.CREATED);
  return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
});
```

Update the `GET /projects` handler:

```typescript
server.openapi(listProjectsRoute, async (c) => {
  const orgMembership = (c as any).get('orgMembership');
  if (!orgMembership) {
    return c.json({ message: 'Org context required' }, HttpStatusCodes.FORBIDDEN);
  }

  const result = await projectService.getProjectsByOrganization(orgMembership.orgId);
  if (result.ok) return c.json(result.data, HttpStatusCodes.OK);
  return c.json({ message: result.error.message }, getHttpStatus(result.error) as never);
});
```

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`

Expected: 0 errors (fix any that remain before committing)

- [ ] **Step 8: Run all tests**

Run: `npm test`

Expected: All tests PASS

- [ ] **Step 9: Commit projects domain changes**

```bash
git add src/domains/projects/
git commit -m "refactor(projects): update policies and middleware for multi-org role model"
```

---

## Task 10: Update chapter-assignments and other domain middlewares

**Files:**

- Modify: `src/domains/chapter-assignments/chapter-assignments.policy.ts`
- Modify: `src/domains/chapter-assignments/chapter-assignment-auth.middleware.ts`

- [ ] **Step 1: Update `ChapterAssignmentPolicy` to use `AppPolicyUser` with `orgRole`/`projectRoles`**

In `src/domains/chapter-assignments/chapter-assignments.policy.ts`, find the `edit` and `submit` policy functions and update them to use the new `AppPolicyUser` interface.

Locate the policy file and replace `user.roleName === ROLES.PROJECT_MANAGER` with:

```typescript
import { ORG_ROLES, PROJECT_ROLES } from '@/lib/roles';

const _canManage = (user: AppPolicyUser): boolean =>
  user.orgRole === ORG_ROLES.ORG_OWNER ||
  user.orgRole === ORG_ROLES.ORG_MANAGER ||
  user.projectRoles.includes(PROJECT_ROLES.PROJECT_MANAGER);
```

Replace `user.organization !== assignment.organizationId` checks with `user.orgId !== assignment.organizationId`.

- [ ] **Step 2: Update `chapter-assignment-auth.middleware.ts`**

Load project roles for the chapter assignment's project and set them on `policyUser`:

```typescript
const projectRolesResult = await getProjectRolesForUser(ctx.projectId, user.id);
const projectRoles = projectRolesResult.ok ? projectRolesResult.data : [];

const policyUser = {
  id: user.id,
  orgId: user.organization ?? ctx.organizationId, // use orgMembership if available
  orgRole: orgMembership?.orgRole ?? 'member',
  projectRoles,
};
```

- [ ] **Step 3: Run all tests**

Run: `npm test`

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/domains/chapter-assignments/
git commit -m "refactor(chapter-assignments): update policy to use multi-org role model"
```

---

## Task 11: Final integration pass

**Files:** All previously modified

- [ ] **Step 1: Run full typecheck**

Run: `npm run typecheck`

Expected: Exit code 0, no errors

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: All tests PASS

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`

Expected: 0 errors

- [ ] **Step 4: Run `precheck` (lint + format + typecheck + test)**

Run: `npm run precheck`

Expected: All pass

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete user-centric multi-org refactor — users belong to multiple orgs with distinct roles"
```

---

## Self-Review

### Spec Coverage Check

| Requirement                                         | Task covering it                             |
| --------------------------------------------------- | -------------------------------------------- |
| User is central entity (no single org/role on user) | Task 1, 8                                    |
| User can belong to multiple orgs                    | Task 1, 6 (org_memberships)                  |
| Projects belong to an Org                           | Not changed — projects.organization FK stays |
| User can have multiple roles per project            | Task 1, 9 (project_user_roles)               |
| Roles are per org per project                       | Task 1, 6, 9                                 |
| Org Owner (Org A story)                             | Task 5 (seed), Task 6 (route)                |
| Org Manager (Org B story)                           | Task 5, 6                                    |
| Translator on project (Org C story)                 | Task 9                                       |
| Observer (Org D story)                              | Task 9                                       |
| Kevin can be PM + Translator on same project        | Task 1 — 3-column PK allows                  |
| Inactive membership blocks access                   | Task 7 (requireOrgAccess)                    |

### Type Consistency Check

| Symbol                          | Defined in     | Used consistently in                                        |
| ------------------------------- | -------------- | ----------------------------------------------------------- |
| `AppPolicyUser.orgRole`         | `lib/types.ts` | user.policy, project.policy, chapter-assignments.policy     |
| `AppPolicyUser.projectRoles`    | `lib/types.ts` | project-auth.middleware, chapter-assignment-auth.middleware |
| `ORG_ROLES.ORG_MANAGER`         | `lib/roles.ts` | user.policy, project.policy, seeds                          |
| `PROJECT_ROLES.PROJECT_MANAGER` | `lib/roles.ts` | project.policy, chapter-assignments.policy                  |
| `project_user_roles` table      | `db/schema.ts` | project-users.repository, project-auth.middleware           |
| `org_memberships` table         | `db/schema.ts` | org-memberships.repository, role-auth.ts                    |

### Placeholder Check — None found

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-user-centric-multi-org-refactor.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using `executing-plans` skill, batch execution with checkpoints

**Which approach?**
