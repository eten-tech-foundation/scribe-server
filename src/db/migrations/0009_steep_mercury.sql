ALTER TABLE "project_units" DROP CONSTRAINT "project_units_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "translated_verses" DROP CONSTRAINT "translated_verses_project_unit_id_project_units_id_fk";
--> statement-breakpoint
ALTER TABLE "project_units" ADD CONSTRAINT "project_units_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translated_verses" ADD CONSTRAINT "translated_verses_project_unit_id_project_units_id_fk" FOREIGN KEY ("project_unit_id") REFERENCES "public"."project_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chapter_assignment_per_chapter" ON "chapter_assignments" USING btree ("project_unit_id","bible_id","book_id","chapter_number");--> statement-breakpoint
ALTER TABLE "chapter_assignments" DROP COLUMN "is_submitted";