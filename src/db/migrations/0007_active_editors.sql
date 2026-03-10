CREATE TABLE "active_chapter_editors" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_assignment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_heartbeat" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_chapter_editors" ADD CONSTRAINT "active_chapter_editors_chapter_assignment_id_chapter_assignments_id_fk" FOREIGN KEY ("chapter_assignment_id") REFERENCES "public"."chapter_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_chapter_editors" ADD CONSTRAINT "active_chapter_editors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_active_editor_per_chapter" ON "active_chapter_editors" USING btree ("chapter_assignment_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_active_editors_chapter" ON "active_chapter_editors" USING btree ("chapter_assignment_id");