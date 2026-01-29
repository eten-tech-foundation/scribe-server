CREATE TYPE "public"."assignment_role" AS ENUM('drafter', 'peer_checker');--> statement-breakpoint
CREATE TABLE "chapter_assignment_assigned_user_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_assignment_id" integer NOT NULL,
	"assigned_user_id" integer NOT NULL,
	"role" "assignment_role" NOT NULL,
	"status" "chapter_status" NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chapter_assignment_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_assignment_id" integer NOT NULL,
	"status" "chapter_status" NOT NULL,
	"assigned_user_id" integer,
	"content" json NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chapter_assignment_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_assignment_id" integer NOT NULL,
	"status" "chapter_status" NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chapter_assignment_assigned_user_history" ADD CONSTRAINT "chapter_assignment_assigned_user_history_chapter_assignment_id_chapter_assignments_id_fk" FOREIGN KEY ("chapter_assignment_id") REFERENCES "public"."chapter_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_assignment_assigned_user_history" ADD CONSTRAINT "chapter_assignment_assigned_user_history_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_assignment_snapshots" ADD CONSTRAINT "chapter_assignment_snapshots_chapter_assignment_id_chapter_assignments_id_fk" FOREIGN KEY ("chapter_assignment_id") REFERENCES "public"."chapter_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_assignment_snapshots" ADD CONSTRAINT "chapter_assignment_snapshots_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_assignment_status_history" ADD CONSTRAINT "chapter_assignment_status_history_chapter_assignment_id_chapter_assignments_id_fk" FOREIGN KEY ("chapter_assignment_id") REFERENCES "public"."chapter_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ca_user_history_assignment" ON "chapter_assignment_assigned_user_history" USING btree ("chapter_assignment_id");--> statement-breakpoint
CREATE INDEX "idx_ca_user_history_user" ON "chapter_assignment_assigned_user_history" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "idx_ca_snapshots_assignment" ON "chapter_assignment_snapshots" USING btree ("chapter_assignment_id");--> statement-breakpoint
CREATE INDEX "idx_ca_snapshots_user" ON "chapter_assignment_snapshots" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "idx_ca_status_history_assignment" ON "chapter_assignment_status_history" USING btree ("chapter_assignment_id");