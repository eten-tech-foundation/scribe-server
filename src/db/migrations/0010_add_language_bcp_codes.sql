CREATE TABLE "language_bcp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"language_name" varchar(255) NOT NULL,
	"bcp47_code" varchar(50),
	"iso639_3_code" varchar(10),
	"iso639_1_code" varchar(10)
);
--> statement-breakpoint
CREATE INDEX "idx_lang_bcp_codes_name" ON "language_bcp_codes" USING btree ("language_name");--> statement-breakpoint
CREATE INDEX "idx_lang_bcp_codes_iso3" ON "language_bcp_codes" USING btree ("iso639_3_code");--> statement-breakpoint
CREATE INDEX "idx_lang_bcp_codes_iso1" ON "language_bcp_codes" USING btree ("iso639_1_code");