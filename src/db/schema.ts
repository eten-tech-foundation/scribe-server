import { z } from '@hono/zod-openapi';
import { boolean, pgTable, uuid, varchar, timestamp, serial } from 'drizzle-orm/pg-core';
import { createSchemaFactory } from 'drizzle-zod';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  role: uuid('role').notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
  isActive: boolean('is_active').notNull().default(true),
});

const { createInsertSchema, createSelectSchema } = createSchemaFactory({
  zodInstance: z,
});

export const selectUsersSchema = createSelectSchema(users);

export const insertUsersSchema = createInsertSchema(users, {
  username: (str) => str.min(1).max(100),
  email: (str) => str.email().max(255),
  firstName: (str) => str.max(100).optional(),
  lastName: (str) => str.max(100).optional(),
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
  });

export const patchUsersSchema = insertUsersSchema.partial();

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),  
  name: varchar('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});