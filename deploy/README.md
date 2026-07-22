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

## Images are built in CI, not on the box

The `backend`, `frontend` and `mcp` images are built by
`.github/workflows/build.yml` on GitHub's runners and pushed to GHCR
(`ghcr.io/<owner>/doc-forge-*`). The VPS only **pulls** them. This keeps a
small (1-core) box from ever running the heavy Vite/npm build, which is slow and
OOM-prone on constrained hardware.

`VITE_*` values are baked into the frontend image at build time, so set them as
GitHub Actions secrets (see the header of `build.yml`), not in the VPS `.env`.

## Prerequisites

- A VPS with Docker Engine + the Compose plugin installed.
- Two DNS `A` records pointing at the VPS IP:
  - `docforge.example.com`      → app + API
  - `mcp.docforge.example.com`  → MCP endpoint
- Ports 80 and 443 open.
- The `build.yml` workflow has run at least once so the GHCR images exist.

## Bring-up

```bash
git clone <this repo> docforge && cd docforge

cp deploy/.env.prod.example .env
# Edit .env: set IMAGE_OWNER, the two domains, ACME_EMAIL, POSTGRES_PASSWORD,
# the Inngest keys, your Azure OpenAI + Clerk (CLERK_JWKS_URL) keys, and
# (optionally) Stripe/PostHog.

# Only if the GHCR packages are private — persists in ~/.docker/config.json:
docker login ghcr.io          # username = GitHub user, password = a PAT (read:packages)

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
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

Push to `main` → `build.yml` rebuilds and pushes the images → `deploy.yml`
pulls them onto the VPS automatically (if the `VPS_*` secrets are set). Manual
equivalent on the box:

```bash
git pull
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Migrations run on every backend start; they are idempotent. To roll back, set
`IMAGE_TAG=<older-commit-sha>` in `.env` and re-run the two commands above.

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

- `build.yml` — builds `backend`/`frontend`/`mcp` and pushes to GHCR on every
  push to `main`. Needs the `VITE_CLERK_PUBLISHABLE_KEY` (and optional
  `VITE_POSTHOG_KEY`) repo secrets for the frontend bundle.
- `deploy.yml` — runs after `build.yml` succeeds and SSHes into the VPS to
  `pull` + `up -d`. Set repo secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
  (and optional `VPS_PATH`, default `/opt/docforge`). The deploy self-skips when
  `VPS_HOST` is absent, so CI stays green without it.

If the GHCR packages are private, give the VPS pull access once with
`docker login ghcr.io` (PAT with `read:packages`); it persists on the box.
