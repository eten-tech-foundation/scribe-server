#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Runtime detection (prefer Podman) ──────────────────────────────────────────

detect_runtime() {
  if command -v podman &>/dev/null && command -v podman-compose &>/dev/null; then
    COMPOSE_CMD="podman-compose"
  elif command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker &>/dev/null && command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    echo "Error: No container runtime found."
    echo "Install one of:"
    echo "  - Podman + podman-compose"
    echo "  - Docker Desktop (includes docker compose V2)"
    echo "  - Docker Engine + docker-compose"
    exit 1
  fi
}

detect_runtime

# ── Commands ───────────────────────────────────────────────────────────────────

cmd="${1:-help}"
shift || true

case "$cmd" in
  up)
    $COMPOSE_CMD up -d --build "$@"
    ;;
  down)
    $COMPOSE_CMD down "$@"
    ;;
  restart)
    $COMPOSE_CMD restart "$@"
    ;;
  logs)
    $COMPOSE_CMD logs -f "$@"
    ;;
  status)
    $COMPOSE_CMD ps "$@"
    ;;

  # ── Database commands ──────────────────────────────────────────────────────

  db:migrate)
    echo "Running fluent-api migrations..."
    $COMPOSE_CMD exec api npx drizzle-kit migrate
    ;;
  db:seed)
    echo "Running fluent-api seeds..."
    # TODO: uncomment when seed files are created
    # $COMPOSE_CMD exec api npx tsx src/db/seeds/roles.ts
    $COMPOSE_CMD exec api npx tsx src/db/seeds/rbac.ts
    # $COMPOSE_CMD exec api npx tsx src/db/seeds/users.ts
    ;;
  db:init)
    echo "Full database initialization (migrations + seeds)..."
    read -rp "This will run all migrations and seeds. Continue? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
      "$0" db:migrate
      "$0" db:seed
      echo "Database initialization complete."
    else
      echo "Aborted."
    fi
    ;;
  db:generate)
    name="${1:?Usage: fapi.sh db:generate <name>}"
    $COMPOSE_CMD exec api npx drizzle-kit generate --name "$name"
    ;;
  db:studio)
    echo "Running Drizzle Studio on host (requires local Node.js)..."
    echo "Connects to DB via DATABASE_URL in .env (localhost:${DB_PORT:-5432})"
    npx drizzle-kit studio
    ;;
  db:psql)
    $COMPOSE_CMD exec db psql -U postgres -d fluent
    ;;

  # ── Service commands ─────────────────────────────────────────────────────

  shell)
    service="${1:-api}"
    if [ "$service" = "db" ]; then
      $COMPOSE_CMD exec db psql -U postgres -d fluent
    else
      $COMPOSE_CMD exec "$service" sh
    fi
    ;;
  test)
    $COMPOSE_CMD exec api npm run test "$@"
    ;;
  run)
    $COMPOSE_CMD exec api npm run "$@"
    ;;

  # ── Lifecycle commands ─────────────────────────────────────────────────────

  clean)
    echo "This will remove all containers AND volumes (full DB reset)."
    read -rp "Continue? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
      $COMPOSE_CMD down -v
      rm -f .db-initialized
    else
      echo "Aborted."
    fi
    ;;
  fresh)
    echo "This will destroy ALL containers, volumes, and images for this project."
    echo "The database will be wiped and everything will be rebuilt from scratch."
    read -rp "Continue? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
      $COMPOSE_CMD down -v --rmi local --remove-orphans
      rm -f .db-initialized
      echo ""
      echo "Clean slate. Run './fapi.sh up' to rebuild and start everything."
    else
      echo "Aborted."
    fi
    ;;
  build)
    $COMPOSE_CMD build --no-cache "$@"
    ;;
  setup)
    if [ ! -f .env ]; then
      cp .env.example .env
      echo "Created .env from .env.example"
    else
      echo ".env already exists, skipping copy."
    fi
    echo "Remember to fill in credentials in .env (Auth0, etc.)"
    ;;
  help|*)
    cat <<'USAGE'
Usage: ./fapi.sh <command> [args]

Services:
  up [service...]        Start containers (build + detached)
  down [service...]      Stop and remove containers
  restart [service...]   Restart specific or all containers
  logs [service]         Tail logs (default: all services)
  status                 Show container status
  shell [service]        Open a shell (api default, db opens psql)
  test                   Run test suite inside the API container
  run <script>           Run an npm script inside the API container

Database:
  db:migrate             Run Drizzle migrations
  db:seed                Run seed scripts
  db:init                Run all migrations then all seeds
  db:generate <name>     Generate a new Drizzle migration
  db:studio              Launch Drizzle Studio on the host
  db:psql                Open psql session

Lifecycle:
  clean                  Remove containers and volumes (full reset)
  fresh                  Nuke everything: containers, volumes, and images
  build [service...]     Rebuild containers without cache
  setup                  Copy .env.example → .env if missing
USAGE
    ;;
esac
