FROM node:22-alpine

WORKDIR /app

# The lib is vendored as a tarball (scripts/vendor-layout.sh), so install needs it.
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --omit=dev

COPY server.mjs ./

ENV HOST=0.0.0.0 \
    PORT=8002 \
    NODE_ENV=production

USER node
EXPOSE 8002

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8002/health || exit 1

CMD ["node", "server.mjs"]
