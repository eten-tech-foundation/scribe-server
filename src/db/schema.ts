import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Json } from 'drizzle-zod';

import { z } from '@hono/zod-openapi';
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { createSchemaFactory } from 'drizzle-zod';
export const userStatusEnum = pgEnum('user_status', ['invited', 'verified', 'inactive']);
export const scriptDirectionEnum = pgEnum('script_direction', ['ltr', 'rtl']);

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

export const languages = pgTable('languages', {
  id: serial('id').primaryKey(),
  langName: varchar('lang_name', { length: 100 }).notNull(),
  langNameLocalized: varchar('lang_name_localized', { length: 100 }),
  langCodeIso6393: varchar('lang_code_iso_639_3', { length: 3 }),
  scriptDirection: scriptDirectionEnum('script_direction').default('ltr'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sourceLanguage: integer('source_language')
    .notNull()
    .references(() => languages.id),
  targetLanguage: integer('target_language')
    .notNull()
    .references(() => languages.id),
  organization: integer('organization')
    .notNull()
    .references(() => organizations.id),
  isActive: boolean('is_active').default(true),
  createdBy: integer('created_by').references(() => users.id),
  assignedTo: integer('assigned_to').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
  metadata: jsonb('metadata').$type<Json>().notNull().default({}),
});

export const bibles = pgTable('bibles', {
  id: serial('id').primaryKey(),
  languageId: integer('language_id')
    .notNull()
    .references(() => languages.id),
  name: varchar('name', { length: 255 }).notNull().unique(),
  abbreviation: varchar('abbreviation', { length: 50 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const books = pgTable('books', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull(),
  eng_display_name: varchar('eng_display_name', { length: 255 }).notNull(),
});

export const bible_books = pgTable('bible_books', {
  bibleId: integer('bible_id')
    .notNull()
    .references(() => bibles.id),
  bookId: integer('book_id')
    .notNull()
    .references(() => books.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const project_units = pgTable('project_units', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const project_unit_bible_books = pgTable('project_unit_bible_books', {
  projectUnitId: integer('project_unit_id')
    .notNull()
    .references(() => project_units.id),
  bibleId: integer('bible_id')
    .notNull()
    .references(() => bibles.id),
  bookId: integer('book_id')
    .notNull()
    .references(() => books.id),
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
export const selectLanguagesSchema = createSelectSchema(languages);
export const selectProjectsSchema = createSelectSchema(projects);
export const selectBiblesSchema = createSelectSchema(bibles);
export const selectBooksSchema = createSelectSchema(books);
export const selectBibleBooksSchema = createSelectSchema(bible_books);

export const selectProjectUnitsSchema = createSelectSchema(project_units);
export const insertProjectUnitsSchema = createInsertSchema(project_units, {
  projectId: (schema) => schema.int(),
  status: (schema) => schema.min(1).max(50),
})
  .required({
    projectId: true,
    status: true,
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export const selectProjectUnitBibleBooksSchema = createSelectSchema(project_unit_bible_books);
export const insertProjectUnitBibleBooksSchema = createInsertSchema(project_unit_bible_books, {
  projectUnitId: (schema) => schema.int(),
  bibleId: (schema) => schema.int(),
  bookId: (schema) => schema.int(),
})
  .required({
    projectUnitId: true,
    bibleId: true,
    bookId: true,
  })
  .omit({
    createdAt: true,
    updatedAt: true,
  });

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

export const insertLanguagesSchema = createInsertSchema(languages, {
  langName: (schema) => schema.max(100).optional(),
  langNameLocalized: (schema) => schema.max(100).optional(),
  langCodeIso6393: (schema) => schema.max(3).optional(),
  scriptDirection: z.enum(['ltr', 'rtl']).default('ltr'),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectsSchema = createInsertSchema(projects, {
  name: (schema) => schema.min(1).max(255),
  sourceLanguage: (schema) => schema.int(),
  targetLanguage: (schema) => schema.int(),
  organization: (schema) => schema.int(),
  isActive: (schema) => schema.default(true),
})
  .required({
    name: true,
    sourceLanguage: true,
    targetLanguage: true,
    organization: true,
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export const insertBiblesSchema = createInsertSchema(bibles, {
  languageId: (schema) => schema.int(),
  name: (schema) => schema.min(1).max(255),
  abbreviation: (schema) => schema.min(1).max(50),
})
  .required({
    languageId: true,
    name: true,
    abbreviation: true,
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export const insertBibleBooksSchema = createInsertSchema(bible_books)
  .required({
    bibleId: true,
    bookId: true,
  })
  .omit({
    createdAt: true,
    updatedAt: true,
  });

export const patchUsersSchema = insertUsersSchema.partial();
export const patchRolesSchema = insertRolesSchema.partial();
export const patchOrganizationsSchema = insertOrganizationsSchema.partial();
export const patchLanguagesSchema = insertLanguagesSchema.partial();
export const patchProjectsSchema = insertProjectsSchema.partial();
export const patchBiblesSchema = insertBiblesSchema.partial();
export const patchBibleBooksSchema = insertBibleBooksSchema.partial();
export const patchProjectUnitsSchema = insertProjectUnitsSchema.partial();
export const patchProjectUnitBibleBooksSchema = insertProjectUnitBibleBooksSchema.partial();
