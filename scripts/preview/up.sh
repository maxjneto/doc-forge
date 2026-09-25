#!/usr/bin/env bash
# Boot the full app locally with a fake Clerk session so an agent (or you) can
# open every screen in a browser. See .claude/skills/validate/SKILL.md.
#
#   scripts/preview/up.sh          # start (idempotent) + reseed
#   scripts/preview/up.sh stop     # stop backend, frontend, JWKS server
#
# Ports: Postgres 5480, JWKS 8765, backend 8000, frontend 5173.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
BACKEND="$ROOT/packages/backend"
FRONTEND="$ROOT/packages/frontend"
STATE="$HERE/.preview-state"
PY="$BACKEND/.venv/bin/python"
PGDATA="${PREVIEW_PGDATA:-/var/lib/postgresql/docforge/data}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
mkdir -p "$STATE"

stop() {
  for name in frontend backend jwks; do
    if [[ -f "$STATE/$name.pid" ]]; then
      kill "$(cat "$STATE/$name.pid")" 2>/dev/null || true
      rm -f "$STATE/$name.pid"
    fi
  done
  pkill -f "uvicorn app.main:app --host 127.0.0.1 --port 8000" 2>/dev/null || true
  echo "stopped"
}

if [[ "${1:-}" == "stop" ]]; then stop; exit 0; fi

up() { curl -sf -o /dev/null "$1"; }
wait_for() {  # url pidfile
  for _ in $(seq 1 90); do
    up "$1" && return 0
    kill -0 "$(cat "$2")" 2>/dev/null || { echo "process died:" >&2; tail -n 20 "${2%.pid}.log" >&2; exit 1; }
    sleep 1
  done
  echo "timed out waiting for $1 (see $STATE/*.log)" >&2; exit 1
}

# ── Postgres ───────────────────────────────────────────────────
if ! pg_isready -h 127.0.0.1 -p 5480 -q; then
  if [[ ! -d "$PGDATA" ]]; then
    mkdir -p "$(dirname "$PGDATA")"; chown postgres "$(dirname "$PGDATA")"
    su postgres -c "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust" >/dev/null
  fi
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-p 5480 -k /var/run/postgresql' -l $PGDATA/../log start" >/dev/null
  for _ in $(seq 1 20); do pg_isready -h 127.0.0.1 -p 5480 -q && break; sleep 0.5; done
fi
psql -h 127.0.0.1 -p 5480 -U postgres -tc "select 1 from pg_database where datname='docforge'" | grep -q 1 \
  || psql -h 127.0.0.1 -p 5480 -U postgres -qc "create database docforge"

# ── Backend deps + schema + fixtures ───────────────────────────
if [[ ! -x "$PY" ]]; then
  (cd "$BACKEND" && uv venv -q .venv && uv pip install -q -p .venv -e ".[dev]")
fi
export DATABASE_URL="postgresql+psycopg://postgres:postgres@127.0.0.1:5480/docforge"
export CLERK_JWKS_URL="http://127.0.0.1:8765/.well-known/jwks.json"
export CLERK_AUTHORIZED_PARTIES='["http://localhost:5173"]'
export CORS_ORIGINS='["http://localhost:5173"]'
export IS_PRODUCTION=false POSTHOG_ENABLED=false STRIPE_ENABLED=false
# No AI in preview: the client just needs *a* key to import. AI actions fail fast.
export AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY:-preview-no-ai}"
export AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT:-http://127.0.0.1:9/}"
(cd "$BACKEND" && .venv/bin/alembic upgrade head >/dev/null 2>&1)
(cd "$BACKEND" && "$PY" "$HERE/seed.py")

# ── JWKS (fake Clerk) ──────────────────────────────────────────
if ! up http://127.0.0.1:8765/; then
  (cd "$HERE" && setsid nohup "$PY" dev_auth.py serve 8765 </dev/null >"$STATE/jwks.log" 2>&1 & echo $! >"$STATE/jwks.pid")
  wait_for http://127.0.0.1:8765/ "$STATE/jwks.pid"
fi
TOKEN="$(cd "$HERE" && "$PY" dev_auth.py token)"

# ── Backend ────────────────────────────────────────────────────
if ! up http://127.0.0.1:8000/api/tiers; then
  (cd "$BACKEND" && setsid nohup .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 \
      </dev/null >"$STATE/backend.log" 2>&1 & echo $! >"$STATE/backend.pid")
  wait_for http://127.0.0.1:8000/api/tiers "$STATE/backend.pid"
fi

# ── Frontend ───────────────────────────────────────────────────
if ! up http://localhost:5173/; then
  [[ -d "$ROOT/node_modules" ]] || (cd "$ROOT" && npm ci)
  (cd "$FRONTEND" && VITE_DEV_AUTH_TOKEN="$TOKEN" VITE_CLERK_PUBLISHABLE_KEY=pk_test_preview \
      VITE_API_BASE=http://localhost:8000/api \
      setsid nohup npx vite --port 5173 --strictPort </dev/null >"$STATE/frontend.log" 2>&1 & echo $! >"$STATE/frontend.pid")
  wait_for http://localhost:5173/ "$STATE/frontend.pid"
fi

echo "preview up → http://localhost:5173/home  (logs: $STATE/*.log)"
