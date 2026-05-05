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

ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

# --- prod stage (used for Azure deploy) ---
FROM nginx:alpine AS prod

COPY --from=builder /app/dist /usr/share/nginx/html

# Redirect all routes to index.html for client-side routing
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
