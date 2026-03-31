#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit migrate

echo "Starting dev server..."
npx tsx watch src/index.ts
