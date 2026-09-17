# syntax=docker/dockerfile:1

FROM node:22.13-bookworm-slim AS deps

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock .npmrc .yarnrc turbo.json ./
COPY apps/affiliate/package.json apps/affiliate/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

RUN yarn install --frozen-lockfile

FROM deps AS builder

ARG NEXT_PUBLIC_SITE_URL=https://artmate.ru
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

COPY . .

RUN yarn workspace affiliate build

FROM node:22.13-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3006
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/affiliate/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/affiliate/.next/static ./apps/affiliate/.next/static

USER nextjs

EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3006/health', { redirect: 'manual', signal: AbortSignal.timeout(3000) }).then(async (response) => { if (response.status !== 200) throw new Error('health status'); const body = await response.json(); if (JSON.stringify(body) !== '{\"status\":\"ok\"}') throw new Error('health body'); }).catch(() => process.exit(1))"

CMD ["node", "apps/affiliate/server.js"]
