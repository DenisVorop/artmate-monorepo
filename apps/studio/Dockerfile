# syntax=docker/dockerfile:1
FROM node:22.13-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY package.json yarn.lock .npmrc .yarnrc turbo.json ./
COPY apps/studio/package.json apps/studio/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN yarn install --frozen-lockfile
FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN yarn workspace studio build
FROM node:22.13-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3005 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app/apps/studio/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/studio/.next/static ./apps/studio/.next/static
USER node
EXPOSE 3005
CMD ["node", "apps/studio/server.js"]
