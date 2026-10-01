FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev && npm cache clean --force

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/app ./app
COPY --from=build --chown=node:node /app/components ./components
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/db ./db
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/next.config.mjs ./next.config.mjs
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
