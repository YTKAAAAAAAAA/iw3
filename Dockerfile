FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Only the traced server output is shipped: no dev tools, no source tree.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PHOTO_STORAGE_DIR=/app/data/photos
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/db ./db
COPY --from=build --chown=node:node /app/lib/db/schema.sql ./lib/db/schema.sql
COPY --from=build --chown=node:node /app/scripts/migrate.mjs /app/scripts/reset-admin-password.mjs ./scripts/
COPY --from=build --chown=node:node /app/docker/entrypoint.sh ./entrypoint.sh
RUN mkdir -p /app/data/photos && chown node:node /app/data/photos
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
