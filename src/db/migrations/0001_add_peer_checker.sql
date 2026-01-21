CREATE TYPE "public"."chapter_status" AS ENUM('not_started', 'draft', 'peer_check', 'community_review');--> statement-breakpoint
CREATE TABLE "user_chapter_assignment_editor_state" (
	"user_id" integer NOT NULL,
	"chapter_assignment_id" integer NOT NULL,
	"resources" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chapter_assignments" ADD COLUMN "peer_checker_id" integer;--> statement-breakpoint
ALTER TABLE "chapter_assignments" ADD COLUMN "chapter_status" "chapter_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_chapter_assignment_editor_state" ADD CONSTRAINT "user_chapter_assignment_editor_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chapter_assignment_editor_state" ADD CONSTRAINT "user_chapter_assignment_editor_state_chapter_assignment_id_chapter_assignments_id_fk" FOREIGN KEY ("chapter_assignment_id") REFERENCES "public"."chapter_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_chapter_assignment_editor_state" ON "user_chapter_assignment_editor_state" USING btree ("user_id","chapter_assignment_id");--> statement-breakpoint
ALTER TABLE "chapter_assignments" ADD CONSTRAINT "chapter_assignments_peer_checker_id_users_id_fk" FOREIGN KEY ("peer_checker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bible_texts_bible_book_chapter" ON "bible_texts" USING btree ("bible_id","book_id","chapter_number");--> statement-breakpoint
CREATE INDEX "idx_bible_texts_bible_book_chapter_verse" ON "bible_texts" USING btree ("bible_id","book_id","chapter_number","verse_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_translated_verse_per_bible_text" ON "translated_verses" USING btree ("project_unit_id","bible_text_id");