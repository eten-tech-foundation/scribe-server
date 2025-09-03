CREATE TYPE "public"."project_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "project_unit_bible_books" (
	"project_unit_id" integer NOT NULL,
	"bible_id" integer NOT NULL,
	"book_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_units" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"status" "project_status" DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_assigned_to_users_id_fk";
--> statement-breakpoint
ALTER TABLE "project_unit_bible_books" ADD CONSTRAINT "project_unit_bible_books_project_unit_id_project_units_id_fk" FOREIGN KEY ("project_unit_id") REFERENCES "public"."project_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_unit_bible_books" ADD CONSTRAINT "project_unit_bible_books_bible_id_bibles_id_fk" FOREIGN KEY ("bible_id") REFERENCES "public"."bibles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_unit_bible_books" ADD CONSTRAINT "project_unit_bible_books_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_units" ADD CONSTRAINT "project_units_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "assigned_to";