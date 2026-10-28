# Running DocForge locally

Two ways to work: the whole stack in Docker (closest to production, one command), or each package on your machine (faster to iterate on one of them). Either way you need a Clerk development instance to sign in; to look at the screens without one, use the [design preview](#looking-at-the-screens-without-a-backend).

## Prerequisites

| Tool | Version | For |
|---|---|---|
| Docker with Compose v2 | recent | the stack, or just Postgres and the layout service |
| Node.js | 22 | frontend, layout service |
| Python | 3.11+ | backend, MCP server |
| A [Clerk](https://clerk.com) application | free development instance | signing in |

From your Clerk application you need two values: the **publishable key** (`pk_test_…`) and the **JWKS URL** (`https://<your-instance>.clerk.accounts.dev/.well-known/jwks.json`, under *API keys → Show JWT public key*).

## Option A — everything in Docker

```bash
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
# packages/backend/.env  → CLERK_JWKS_URL=<your JWKS URL>
# packages/frontend/.env → VITE_CLERK_PUBLISHABLE_KEY=<your pk_test_…>

docker compose up --build
```

| Service | URL |
|---|---|
| App | http://localhost:5173 |
| API | http://localhost:8000/api (health: `/api/health`) |
| MCP server | http://localhost:8001/mcp |
| Layout service | http://localhost:8002 (internal; health: `/health`) |
| Postgres | `localhost:5480`, user/password `postgres`/`postgres`, database `docforge` |

The backend runs `alembic upgrade head` on start. The containers run the sources copied in at build time: after changing code, `docker compose up --build <service>`, or work on that package with option B.

> **A database from before October 2026** (from the old 38-migration chain) cannot be upgraded to the current baseline. Start it fresh: `docker compose down -v` deletes the `pgdata` volume.

## Option B — each package on its own

Run the dependencies in Docker and the package you are working on locally:

```bash
docker compose up -d postgres layout
```

### Backend

```bash
cd packages/backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env           # set CLERK_JWKS_URL; DATABASE_URL already points at :5480
alembic upgrade head
python run.py                  # http://localhost:8000 — on Windows this sets the event loop psycopg needs
```

### Frontend

```bash
npm install                    # at the repository root (npm workspaces)
cd packages/frontend
cp .env.example .env           # set VITE_CLERK_PUBLISHABLE_KEY
npm run dev                    # http://localhost:5173
```

### MCP server

```bash
cd packages/mcp
pip install -e ".[dev]"
DOCFORGE_API_BASE=http://localhost:8000/api DOCFORGE_FRONTEND_BASE=http://localhost:5173 \
  docforge-mcp-server          # http://localhost:8001/mcp
```

### Layout service

```bash
cd packages/layout-service
npm install --workspaces=false
npm start                      # http://localhost:8002
```

## Connecting an agent to your local DocForge

1. Sign in at http://localhost:5173, open **DocForge MCP** and create an API key.
2. Add the local server to your client, for example Claude Code:

   ```bash
   claude mcp add --transport http docforge-local http://localhost:8001/mcp \
     --header "Authorization: Bearer <key>"
   ```

3. Ask the agent to "read the DocForge guide and create a one-page report about …". Documents it creates open at http://localhost:5173/document/<id>.

To check the whole agent path without a client:

```bash
DOCFORGE_API_KEY=<key> python scripts/smoke-mcp.py --url http://localhost:8001/mcp
```

It creates a layout document and a deck, applies operations, previews, reviews, renders a page to PNG, saves versions and themes, and prints how long each tool took and how much it returned.

## Looking at the screens without a backend

```bash
cd packages/frontend
npm run dev:preview            # http://localhost:5199
```

The real app with Clerk stubbed and the API answered from `preview/fixtures.ts`. Open `/home`, `/document/doc-copasim` (Markdown with a pending suggestion), `/document/doc-layout-q3` (a layout report), `/document/doc-layout-deck` (slides), `/mcp` or `/billing`. Layout documents keep state in the preview: edits run through the real library.

## Working on the layout library

The library lives in its own repository, [docforge-layout](https://github.com/maxjneto/docforge-layout). To try unreleased changes in DocForge, clone it next to this repository and vendor a build:

```bash
git clone https://github.com/maxjneto/docforge-layout.git ../docforge-layout
scripts/vendor-layout.sh       # packs ../docforge-layout into the frontend and the layout service
```

The script prints what to run afterwards (installs and lockfiles). Released versions come from npm.

## Tests and checks

What CI runs, package by package:

```bash
# backend — ~140 tests, SQLite in memory, no services needed
cd packages/backend && ruff check . && pytest tests -q

# frontend
cd packages/frontend && npx tsc --noEmit && npm run lint:tokens && npm run test && npm run build

# MCP server
cd packages/mcp && ruff check src/ tests/ && pytest tests -q

# layout service — the routes and fields the backend relies on
cd packages/layout-service && npm test
```

CI also applies the migrations to a real Postgres (`alembic upgrade head`).

## Database changes

Models in `packages/backend/app/models` are the source of truth. After changing one:

```bash
cd packages/backend
alembic revision --autogenerate -m "short description"
# read the generated file in alembic/versions/ and fix what autogenerate cannot see
alembic upgrade head
```

Postgres-only details (partial indexes, server defaults) need care: the test suite runs on SQLite.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `401` on every API call after signing in | `CLERK_JWKS_URL` is from a different Clerk instance than the publishable key, or `CLERK_AUTHORIZED_PARTIES` does not include `http://localhost:5173` |
| `alembic` complains about an unknown revision | the database predates the baseline: `docker compose down -v` |
| Layout documents fail with `503` | the layout service is not running (`docker compose up -d layout`) |
| The backend cannot connect to Postgres on Windows | run it with `python run.py`, which sets the selector event loop psycopg needs |
