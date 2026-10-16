# syntax=docker/dockerfile:1

# --- dev stage (used by docker-compose locally) ---
# Node 22, not 20: npm 10.8 (Node 20) detects libc with a networked
# process.report.getReport(), which reverse-resolves every open registry socket
# and stalls the install ~6 min under Docker Desktop's DNS. npm 10.9 reads ldd.
FROM node:22-alpine AS dev

WORKDIR /app

# The frontend keeps its own lockfile for Docker (the workspace lock at the repo
# root is outside this build context). Regenerate it with `npm run lock` here.
COPY package.json package-lock.json ./
# @docforge/layout is vendored as a tarball (scripts/vendor-layout.sh).
COPY vendor ./vendor
# The cache mount keeps downloaded tarballs across builds, so re-vendoring the
# lib (which invalidates this layer) does not download everything again.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- build stage ---
FROM dev AS builder

# All VITE_* vars are baked at build time (Vite inlines them). Pass them as
# build args from docker-compose.prod.yml (sourced from .env). A relative
# VITE_API_BASE (/api) keeps the frontend same-origin behind the reverse proxy.
ARG VITE_API_BASE=/api
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST=https://us.i.posthog.com
# Where agents connect, shown in every setup snippet of the app.
ARG VITE_MCP_URL=https://mcp.doc-forge.dev/mcp
ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY \
    VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY \
    VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST \
    VITE_MCP_URL=$VITE_MCP_URL

RUN npm run build

# --- prod stage (static assets served by nginx, behind the Caddy proxy) ---
FROM nginx:alpine AS prod

COPY --from=builder /app/dist /usr/share/nginx/html

# Redirect all routes to index.html for client-side routing
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf

# Master runs as root so the official entrypoint can create /var/cache/nginx
# temp dirs and the pid file; nginx still drops workers to the `nginx` user via
# the built-in `user nginx;` directive. (For a non-root image instead, base off
# nginxinc/nginx-unprivileged and point the Caddyfile at frontend:8080.)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
