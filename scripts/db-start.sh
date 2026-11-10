#!/usr/bin/env bash
# Starts a throwaway local Postgres for `npm run db:test` on port 54329.
# Data lives in .tmp/pgdata (git-ignored). Run `npm run db:stop` to stop it.
set -euo pipefail

PORT="${TEST_DB_PORT:-54329}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/.tmp/pgdata"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
[ -x "$BIN/initdb" ] || BIN="$(dirname "$(command -v initdb || echo /usr/bin/initdb)")"

# Postgres refuses to run as root; use an unprivileged user when needed.
RUN=()
if [ "$(id -u)" = "0" ]; then
  USER_NAME="${TEST_DB_OS_USER:-postgres}"
  id "$USER_NAME" >/dev/null 2>&1 || useradd --system --no-create-home "$USER_NAME"
  RUN=(runuser -u "$USER_NAME" --)
fi

mkdir -p "$DIR"
[ "${#RUN[@]}" -gt 0 ] && chown -R "${TEST_DB_OS_USER:-postgres}" "$(dirname "$DIR")"

if [ ! -f "$DIR/PG_VERSION" ]; then
  "${RUN[@]}" "$BIN/initdb" -D "$DIR" -U postgres --auth=trust --no-instructions >/dev/null
fi

if "${RUN[@]}" "$BIN/pg_ctl" -D "$DIR" status >/dev/null 2>&1; then
  echo "Test database already running on port $PORT"
  exit 0
fi

"${RUN[@]}" "$BIN/pg_ctl" -D "$DIR" -l "$DIR/server.log" -w \
  -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" start >/dev/null
echo "Test database running on port $PORT"
