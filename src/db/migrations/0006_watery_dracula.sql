CREATE TABLE "bible_texts" (
	"id" serial PRIMARY KEY NOT NULL,
	"bible_id" integer NOT NULL,
	"book_id" integer NOT NULL,
	"chapter_number" integer NOT NULL,
	"verse_number" integer NOT NULL,
	"text" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chapter_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_unit_id" integer NOT NULL,
	"bible_id" integer NOT NULL,
	"book_id" integer NOT NULL,
	"chapter_number" integer NOT NULL,
	"assigned_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "translated_verses" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_unit_id" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"content" varchar NOT NULL,
	"bible_text_id" integer NOT NULL,
	"assigned_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bible_texts" ADD CONSTRAINT "bible_texts_bible_id_bibles_id_fk" FOREIGN KEY ("bible_id") REFERENCES "public"."bibles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bible_texts" ADD CONSTRAINT "bible_texts_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_assignments" ADD CONSTRAINT "chapter_assignments_project_unit_id_project_units_id_fk" FOREIGN KEY ("project_unit_id") REFERENCES "public"."project_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_assignments" ADD CONSTRAINT "chapter_assignments_bible_id_bibles_id_fk" FOREIGN KEY ("bible_id") REFERENCES "public"."bibles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_assignments" ADD CONSTRAINT "chapter_assignments_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_assignments" ADD CONSTRAINT "chapter_assignments_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translated_verses" ADD CONSTRAINT "translated_verses_project_unit_id_project_units_id_fk" FOREIGN KEY ("project_unit_id") REFERENCES "public"."project_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translated_verses" ADD CONSTRAINT "translated_verses_bible_text_id_bible_texts_id_fk" FOREIGN KEY ("bible_text_id") REFERENCES "public"."bible_texts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translated_verses" ADD CONSTRAINT "translated_verses_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;