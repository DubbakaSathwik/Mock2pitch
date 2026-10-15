#!/usr/bin/env bash
# Starts the throw-away test PostgreSQL on :54329 if it is not already running. Works as root (runs the server as the `postgres` user).
# Usage: scripts/pg-up.sh   (then: npm test)
set -euo pipefail
if (command -v pg_isready >/dev/null && pg_isready -q -h localhost -p 54329) 2>/dev/null; then echo "postgres :54329 already up"; exit 0; fi
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ "$(id -u)" = "0" ]; then
  su postgres -c "PG_TEST_DIR=/var/lib/postgresql/m2p bash $HERE/pg-test-server.sh"
else
  bash "$HERE/pg-test-server.sh"
fi
sleep 2
