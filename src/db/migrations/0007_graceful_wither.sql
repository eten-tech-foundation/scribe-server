ALTER TABLE "chapter_assignments" ADD COLUMN "is_submitted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "chapter_assignments" ADD COLUMN "submitted_time" timestamp;