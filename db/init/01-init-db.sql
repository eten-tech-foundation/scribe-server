-- PostgreSQL roles and privileges for local development.
-- Canonical source — fluent-ai copies from this file.
-- Executed automatically on first DB volume initialization via
-- docker-entrypoint-initdb.d. Safe to re-examine in psql; not re-run.

-- ================================================================
-- SECTION 1: LOGIN USERS
-- ================================================================

CREATE USER db_admin   WITH PASSWORD 'password' CREATEROLE;
CREATE USER migrations WITH PASSWORD 'password';
CREATE USER web_user   WITH PASSWORD 'password';
CREATE USER ai_user    WITH PASSWORD 'password';

-- ================================================================
-- SECTION 2: GROUP ROLES (no login)
-- ================================================================

CREATE ROLE role_web_data;       -- full DML on public schema
CREATE ROLE role_pgboss_user;    -- full DML on pgboss schema
CREATE ROLE role_ai_data;        -- full DML on ai schema
CREATE ROLE role_ai_reader;      -- SELECT on public schema (cross-schema reads for fluent-ai)
CREATE ROLE role_migrations;     -- DDL + DML across all schemas

-- ================================================================
-- SECTION 3: ASSIGN ROLES TO LOGIN USERS
-- ================================================================

GRANT role_web_data,  role_pgboss_user                  TO web_user;
GRANT role_ai_data,   role_ai_reader, role_pgboss_user  TO ai_user;
GRANT role_migrations                                    TO migrations;

-- ================================================================
-- SECTION 4: CREATE SCHEMAS
-- ================================================================

CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE SCHEMA IF NOT EXISTS pgboss;
CREATE SCHEMA IF NOT EXISTS ai;

-- public already exists; postgres retains ownership (superuser default).
ALTER SCHEMA drizzle OWNER TO migrations;
ALTER SCHEMA pgboss  OWNER TO web_user;
ALTER SCHEMA ai      OWNER TO ai_user;

-- ================================================================
-- SECTION 5: SCHEMA USAGE GRANTS
-- ================================================================

GRANT USAGE ON SCHEMA public  TO role_web_data, role_ai_reader, role_migrations;
GRANT CREATE ON SCHEMA public TO role_migrations;
GRANT USAGE ON SCHEMA drizzle TO role_migrations;
GRANT CREATE ON SCHEMA drizzle TO role_migrations;
GRANT USAGE  ON SCHEMA pgboss TO role_pgboss_user;
GRANT CREATE ON SCHEMA pgboss TO role_pgboss_user;
GRANT USAGE ON SCHEMA ai      TO role_ai_data;

-- db_admin: convenience DBA account for local inspection; not a runtime user
GRANT USAGE ON SCHEMA public, pgboss, ai, drizzle TO db_admin;

-- ================================================================
-- SECTION 6: DEFAULT PRIVILEGES
-- Set for BOTH postgres (current Drizzle user) and migrations (future
-- least-privilege target) so grants apply regardless of who runs migrations.
-- ================================================================

-- Tables created by postgres
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_web_data;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT ON TABLES TO role_ai_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO role_web_data, role_ai_reader;

-- Tables created by migrations
ALTER DEFAULT PRIVILEGES FOR ROLE migrations IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_web_data;
ALTER DEFAULT PRIVILEGES FOR ROLE migrations IN SCHEMA public
  GRANT SELECT ON TABLES TO role_ai_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE migrations IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO role_web_data, role_ai_reader;

-- Tables created by web_user in pgboss schema
ALTER DEFAULT PRIVILEGES FOR ROLE web_user IN SCHEMA pgboss
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_pgboss_user;
ALTER DEFAULT PRIVILEGES FOR ROLE web_user IN SCHEMA pgboss
  GRANT USAGE, SELECT ON SEQUENCES TO role_pgboss_user;

-- Tables created by ai_user in ai schema
ALTER DEFAULT PRIVILEGES FOR ROLE ai_user IN SCHEMA ai
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_ai_data;
ALTER DEFAULT PRIVILEGES FOR ROLE ai_user IN SCHEMA ai
  GRANT USAGE, SELECT ON SEQUENCES TO role_ai_data;
