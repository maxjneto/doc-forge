# Deploying DocForge on a VPS

This replaces the previous Azure Container Apps setup with a self-contained
Docker Compose stack you can run on any single VPS (Hetzner, DigitalOcean, a
bare Ubuntu box, etc.). Caddy handles TLS automatically.

## What runs

| Service    | Role                                             | Exposed |
|------------|--------------------------------------------------|---------|
| `caddy`    | Reverse proxy + automatic HTTPS (Let's Encrypt)  | 80, 443 |
| `frontend` | Built SPA served by nginx                         | internal |
| `backend`  | FastAPI (API, SSE, Inngest webhook)              | internal |
| `mcp`      | MCP streamable-HTTP server                        | internal |
| `postgres` | Database (durable volume)                         | internal |
| `redis`    | SSE pub/sub fan-out (durable volume)              | internal |
| `inngest`  | Self-hosted job runner for the guided executor   | internal |

Only Caddy is reachable from the internet; Postgres and Redis never leave the
internal Docker network.

## Prerequisites

- A VPS with Docker Engine + the Compose plugin installed.
- Two DNS `A` records pointing at the VPS IP:
  - `docforge.example.com`      → app + API
  - `mcp.docforge.example.com`  → MCP endpoint
- Ports 80 and 443 open.

## Bring-up

```bash
git clone <this repo> docforge && cd docforge

cp deploy/.env.prod.example .env
# Edit .env: set the two domains, ACME_EMAIL, POSTGRES_PASSWORD, the Inngest
# keys, your Azure OpenAI + Clerk keys, and (optionally) Stripe/PostHog.

docker compose -f docker-compose.prod.yml up -d --build
```

The backend runs `alembic upgrade head` on start, so the schema (including the
seeded document types) is created automatically. Caddy provisions TLS
certificates on first request — allow a minute.

Check health:

```bash
docker compose -f docker-compose.prod.yml ps
curl -I https://docforge.example.com          # SPA
curl -s  https://docforge.example.com/api/tiers | head   # API
```

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migrations run on every backend start; they are idempotent.

## Notes / decisions

- **`VITE_*` are build-time.** The frontend bundle bakes them in, so a change to
  `VITE_CLERK_PUBLISHABLE_KEY` etc. requires a `--build`. `VITE_API_BASE` is
  fixed to `/api` (same-origin behind Caddy).
- **Stripe webhooks** target `https://docforge.example.com/api/billing/webhook`
  — register that URL in the Stripe dashboard and put the signing secret in
  `.env` as `STRIPE_WEBHOOK_SECRET`.
- **Inngest** runs as a single self-hosted node (`inngest start`) with a durable
  sqlite volume. That is enough for the hosted guided executor on one box. For
  HA move to Inngest Cloud — the `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` are
  already wired.
- **Backups:** snapshot the `pgdata` volume (e.g. `docker compose exec postgres
  pg_dump -U postgres docforge`) on a schedule.

## CI/CD

`.github/workflows/*` build and push images to GHCR on pushes to `main` and can
optionally deploy over SSH — see the comments in each workflow for the repo
secrets to set (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`). Deploy steps are skipped
automatically when those secrets are absent, so CI stays green without them.
