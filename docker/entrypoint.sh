#!/bin/sh
# Schema migrations run on every start (they are idempotent and take an
# advisory lock), so deploying a new image is just `docker compose up -d`.
set -e
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node scripts/migrate.mjs
fi
exec node server.js
