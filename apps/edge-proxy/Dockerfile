# syntax=docker/dockerfile:1

FROM node:22.13-bookworm-slim AS deps

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock .npmrc .yarnrc turbo.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/edge-proxy/package.json apps/edge-proxy/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/site/package.json apps/site/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN yarn install --frozen-lockfile

FROM deps AS builder

COPY . .

RUN yarn workspace edge-proxy build

FROM node:22.13-bookworm-slim AS runner

WORKDIR /app/apps/edge-proxy

ENV NODE_ENV=production
ENV PORT=3004

COPY --from=builder --chown=node:node /app/apps/edge-proxy/package.json ./package.json
COPY --from=builder --chown=node:node /app/apps/edge-proxy/dist ./dist

USER node

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3004/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
