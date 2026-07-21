# --- dev stage (used by docker-compose locally) ---
FROM node:20-alpine AS dev

WORKDIR /app

COPY package.json ./
RUN npm install

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
ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY \
    VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY \
    VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST

RUN npm run build

# --- prod stage (static assets served by nginx, behind the Caddy proxy) ---
FROM nginx:alpine AS prod

COPY --from=builder /app/dist /usr/share/nginx/html

# Redirect all routes to index.html for client-side routing
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
