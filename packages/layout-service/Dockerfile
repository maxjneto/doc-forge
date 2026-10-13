FROM node:22-alpine

WORKDIR /app

# The lib is vendored as a tarball (scripts/vendor-layout.sh) and ships the server
# itself (`docforge-layout serve`), so this image is just Node + the package.
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --omit=dev

ENV NODE_ENV=production

USER node
EXPOSE 8002

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8002/health || exit 1

CMD ["node_modules/.bin/docforge-layout", "serve", "--host", "0.0.0.0", "--port", "8002"]
