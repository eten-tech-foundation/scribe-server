CREATE TYPE "public"."user_status" AS ENUM('invited', 'verified', 'inactive');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'invited' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_active";