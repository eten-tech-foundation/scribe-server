import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { z } from '@hono/zod-openapi';
import { integer, pgEnum, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createSchemaFactory } from 'drizzle-zod';
export const userStatusEnum = pgEnum('user_status', ['invited', 'verified', 'inactive']);

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  role: integer('role')
    .notNull()
    .references(() => roles.id),
  organization: integer('organization')
    .notNull()
    .references(() => organizations.id),
  status: userStatusEnum('status').notNull().default('invited'),
  createdBy: integer('created_by').references((): AnyPgColumn => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

const { createInsertSchema, createSelectSchema } = createSchemaFactory({
  zodInstance: z,
});

export const selectUsersSchema = createSelectSchema(users);
export const selectRolesSchema = createSelectSchema(roles);
export const selectOrganizationsSchema = createSelectSchema(organizations);

export const insertUsersSchema = createInsertSchema(users, {
  username: (schema) => schema.min(1).max(100),
  email: (schema) => schema.email().max(255),
  firstName: (schema) => schema.max(100).optional(),
  lastName: (schema) => schema.max(100).optional(),
  status: z.enum(['invited', 'verified', 'inactive']).default('invited'),
})
  .required({
    username: true,
    email: true,
    role: true,
    organization: true,
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export const insertRolesSchema = createInsertSchema(roles, {
  name: (schema) => schema.min(1).max(255),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationsSchema = createInsertSchema(organizations, {
  name: (schema) => schema.min(1).max(100),
})
  .required({ name: true })
  .omit({ id: true, createdAt: true, updatedAt: true });

export const patchUsersSchema = insertUsersSchema.partial();
export const patchRolesSchema = insertRolesSchema.partial();
export const patchOrganizationsSchema = insertOrganizationsSchema.partial();
