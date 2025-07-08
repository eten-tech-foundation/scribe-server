import { z } from '@hono/zod-openapi';
import { boolean, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
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
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull().default('user'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
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
  name: (str) => str.min(1).max(100),
  email: (str) => str.email(),
  role: (str) => str.min(1).max(50),
})
  .required({
    name: true,
    email: true,
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export const patchUsersSchema = insertUsersSchema.partial();
