#Requires -Version 5.1
param(
    [Parameter(Position = 0)]
    [string]$Command = "help",
    [Parameter(Position = 1, ValueFromRemainingArguments)]
    [string[]]$Args
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# ── Runtime detection (prefer Podman) ──────────────────────────────────────────

function Get-ComposeCommand {
    if ((Get-Command podman -ErrorAction SilentlyContinue) -and (Get-Command podman-compose -ErrorAction SilentlyContinue)) {
        return "podman-compose"
    }
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        $v2 = & docker compose version 2>&1
        if ($LASTEXITCODE -eq 0) { return "docker compose" }
        if (Get-Command docker-compose -ErrorAction SilentlyContinue) { return "docker-compose" }
    }
    Write-Error @"
No container runtime found. Install one of:
  - Podman + podman-compose
  - Docker Desktop (includes docker compose V2)
  - Docker Engine + docker-compose
"@
    exit 1
}

$Compose = Get-ComposeCommand

function Invoke-Compose {
    param([string[]]$ComposeArgs)
    if ($Compose -eq "docker compose") {
        & docker compose @ComposeArgs
    } else {
        & $Compose @ComposeArgs
    }
}

# ── Commands ───────────────────────────────────────────────────────────────────

switch ($Command) {
    "up" {
        Invoke-Compose @("up", "-d", "--build") + $Args
    }
    "down" {
        Invoke-Compose @("down") + $Args
    }
    "restart" {
        Invoke-Compose @("restart") + $Args
    }
    "logs" {
        Invoke-Compose @("logs", "-f") + $Args
    }
    "status" {
        Invoke-Compose @("ps") + $Args
    }

    # ── Database commands ──────────────────────────────────────────────────────

    "db:migrate" {
        Write-Host "Running fluent-api migrations..."
        Invoke-Compose @("exec", "api", "npx", "drizzle-kit", "migrate")
    }
    "db:seed" {
        Write-Host "Running fluent-api seeds..."
        # TODO: uncomment when seed files are created
        # Invoke-Compose @("exec", "api", "npx", "tsx", "src/db/seeds/roles.ts")
        Invoke-Compose @("exec", "api", "npx", "tsx", "src/db/seeds/rbac.ts")
        # Invoke-Compose @("exec", "api", "npx", "tsx", "src/db/seeds/users.ts")
    }
    "db:init" {
        Write-Host "Full database initialization (migrations + seeds)..."
        $confirm = Read-Host "This will run all migrations and seeds. Continue? [y/N]"
        if ($confirm -match "^[Yy]$") {
            & $MyInvocation.MyCommand.Path "db:migrate"
            & $MyInvocation.MyCommand.Path "db:seed"
            Write-Host "Database initialization complete."
        } else {
            Write-Host "Aborted."
        }
    }
    "db:generate" {
        if ($Args.Count -lt 1) { Write-Error "Usage: fapi.ps1 db:generate <name>"; exit 1 }
        Invoke-Compose @("exec", "api", "npx", "drizzle-kit", "generate", "--name", $Args[0])
    }
    "db:studio" {
        $port = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
        Write-Host "Running Drizzle Studio on host (requires local Node.js)..."
        Write-Host "Connects to DB via DATABASE_URL in .env (localhost:$port)"
        npx drizzle-kit studio
    }
    "db:psql" {
        Invoke-Compose @("exec", "db", "psql", "-U", "postgres", "-d", "fluent")
    }

    # ── Service commands ─────────────────────────────────────────────────────

    "shell" {
        $service = if ($Args.Count -gt 0) { $Args[0] } else { "api" }
        if ($service -eq "db") {
            Invoke-Compose @("exec", "db", "psql", "-U", "postgres", "-d", "fluent")
        } else {
            Invoke-Compose @("exec", $service, "sh")
        }
    }
    "test" {
        Invoke-Compose @("exec", "api", "npm", "run", "test") + $Args
    }
    "run" {
        Invoke-Compose @("exec", "api", "npm", "run") + $Args
    }

    # ── Lifecycle commands ─────────────────────────────────────────────────────

    "clean" {
        Write-Host "This will remove all containers AND volumes (full DB reset)."
        $confirm = Read-Host "Continue? [y/N]"
        if ($confirm -match "^[Yy]$") {
            Invoke-Compose @("down", "-v")
            Remove-Item -Force -ErrorAction SilentlyContinue .db-initialized
        } else {
            Write-Host "Aborted."
        }
    }
    "fresh" {
        Write-Host "This will destroy ALL containers, volumes, and images for this project."
        Write-Host "The database will be wiped and everything will be rebuilt from scratch."
        $confirm = Read-Host "Continue? [y/N]"
        if ($confirm -match "^[Yy]$") {
            Invoke-Compose @("down", "-v", "--rmi", "local", "--remove-orphans")
            Remove-Item -Force -ErrorAction SilentlyContinue .db-initialized
            Write-Host ""
            Write-Host "Clean slate. Run '.\fapi.ps1 up' to rebuild and start everything."
        } else {
            Write-Host "Aborted."
        }
    }
    "build" {
        Invoke-Compose @("build", "--no-cache") + $Args
    }
    "setup" {
        if (-not (Test-Path .env)) {
            Copy-Item .env.example .env
            Write-Host "Created .env from .env.example"
        } else {
            Write-Host ".env already exists, skipping copy."
        }
        Write-Host "Remember to fill in credentials in .env (Auth0, etc.)"
    }
    default {
        @"
Usage: .\fapi.ps1 <command> [args]

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
  setup                  Copy .env.example -> .env if missing
"@
    }
}
