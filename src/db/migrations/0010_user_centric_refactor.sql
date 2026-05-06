CREATE TYPE "public"."org_role" AS ENUM('org_owner', 'org_manager', 'member');--> statement-breakpoint
CREATE TYPE "public"."project_role" AS ENUM('project_manager', 'translator', 'peer_checker', 'observer');--> statement-breakpoint
CREATE TABLE "org_memberships" (
	"user_id" integer NOT NULL,
	"org_id" integer NOT NULL,
	"org_role" "org_role" DEFAULT 'member' NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "org_memberships_user_id_org_id_pk" PRIMARY KEY("user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "project_user_roles" (
	"project_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"project_role" "project_role" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "project_user_roles_project_id_user_id_project_role_pk" PRIMARY KEY("project_id","user_id","project_role")
);
--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_user_roles" ADD CONSTRAINT "project_user_roles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_user_roles" ADD CONSTRAINT "project_user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_org_memberships_user" ON "org_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_org_memberships_org" ON "org_memberships" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_project_user_roles_project" ON "project_user_roles" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_user_roles_user" ON "project_user_roles" USING btree ("user_id");--> statement-breakpoint
-- Data migration: move user org/role/status/createdBy into org_memberships
INSERT INTO "org_memberships" ("user_id", "org_id", "org_role", "status", "created_by", "created_at", "updated_at")
SELECT
  u."id",
  u."organization",
  CASE r."name"
    WHEN 'Manager' THEN 'org_manager'
    WHEN 'Org Owner' THEN 'org_owner'
    ELSE 'member'
  END::"org_role",
  u."status",
  u."created_by",
  NOW(),
  NOW()
FROM "users" u
JOIN "roles" r ON u."role" = r."id"
WHERE u."organization" IS NOT NULL;
--> statement-breakpoint
-- Data migration: project_users to project_user_roles using user's old role as project role
INSERT INTO "project_user_roles" ("project_id", "user_id", "project_role", "created_at", "updated_at")
SELECT
  pu."project_id",
  pu."user_id",
  CASE r."name"
    WHEN 'Manager' THEN 'project_manager'
    WHEN 'Translator' THEN 'translator'
    ELSE 'observer'
  END::"project_role",
  COALESCE(pu."created_at", NOW()),
  NOW()
FROM "project_users" pu
JOIN "users" u ON pu."user_id" = u."id"
JOIN "roles" r ON u."role" = r."id";
--> statement-breakpoint
DROP TABLE "project_users" CASCADE;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_role_roles_id_fk";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_organization_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_created_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "organization";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "created_by";
