#!/usr/bin/env bash
# Starts a throw-away local PostgreSQL (>= 15, with contrib citext + pgcrypto) on :54329 for the DB/function tests.
# Needs a Postgres install (e.g. /usr/lib/postgresql/16/bin) and must run as a non-root user (use `su postgres -c` as root).
# Tests read TEST_DATABASE_URL (default postgres://postgres@localhost:54329/postgres).
set -euo pipefail
BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
DIR="${PG_TEST_DIR:-$HOME/.m2p-pg}"
[ -d "$DIR/data" ] || { mkdir -p "$DIR"; "$BIN/initdb" -D "$DIR/data" -A trust -U postgres >/dev/null; }
"$BIN/pg_ctl" -D "$DIR/data" -o "-p 54329 -k /tmp -c fsync=off -c max_connections=50" -l "$DIR/pg.log" start
