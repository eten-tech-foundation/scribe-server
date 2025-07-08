import { z } from '@hono/zod-openapi';
import { boolean, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createSchemaFactory } from 'drizzle-zod';

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  done: boolean('done').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const users = pgTable('users', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  username: text('username').notNull(),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  role: text('role').notNull(), // UUID stored as text
  createdBy: text('created_by'), // UUID stored as text
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
});

const { createInsertSchema, createSelectSchema } = createSchemaFactory({
  zodInstance: z,
});

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

export const selectUsersSchema = createSelectSchema(users);

export const insertUsersSchema = createInsertSchema(users, {
  username: (str) => str.min(1).max(100),
  email: (str) => str.email(),
  firstName: (str) => str.min(1).max(100).optional(),
  lastName: (str) => str.min(1).max(100).optional(),
  role: (str) => str.uuid(), // Role as UUID
})
  .required({
    username: true,
    email: true,
    role: true,
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
  })
  .transform((data) => ({
    ...data,
    // Convert empty strings to null for optional fields
    firstName: data.firstName === '' ? null : data.firstName,
    lastName: data.lastName === '' ? null : data.lastName,
  }));

export const patchUsersSchema = createInsertSchema(users, {
  username: (str) => str.min(1).max(100),
  email: (str) => str.email(),
  firstName: (str) => str.min(1).max(100).optional(),
  lastName: (str) => str.min(1).max(100).optional(),
  role: (str) => str.uuid(), // Role as UUID
})
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
  })
  .partial()
  .transform((data) => ({
    ...data,
    // Convert empty strings to null for optional fields
    firstName: data.firstName === '' ? null : data.firstName,
    lastName: data.lastName === '' ? null : data.lastName,
  }));
