# syntax=docker/dockerfile:1

FROM node:22.13-bookworm-slim AS deps

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock .npmrc .yarnrc turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN yarn install --frozen-lockfile

FROM deps AS builder

COPY . .

RUN yarn workspace api build

FROM node:22.13-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fontconfig \
    fonts-dejavu-core \
  && fc-cache -f \
  && rm -rf /var/lib/apt/lists/*

COPY apps/api/certificates/russian-trusted-root-ca.crt \
  apps/api/certificates/russian-trusted-sub-ca-2024.crt \
  apps/api/certificates/SHA256SUMS \
  /tmp/tbank-ca/

RUN cd /tmp/tbank-ca \
  && sha256sum -c SHA256SUMS \
  && openssl verify \
    -CAfile russian-trusted-root-ca.crt \
    russian-trusted-sub-ca-2024.crt \
  && install -m 0644 \
    russian-trusted-root-ca.crt \
    /usr/local/share/ca-certificates/russian-trusted-root-ca.crt \
  && install -m 0644 \
    russian-trusted-sub-ca-2024.crt \
    /usr/local/share/ca-certificates/russian-trusted-sub-ca-2024.crt \
  && update-ca-certificates \
  && rm -rf /tmp/tbank-ca

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY --from=builder --chown=node:node /app/package.json /app/yarn.lock /app/.npmrc /app/.yarnrc /app/turbo.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/apps/site/src/widgets/header/assets/logo-square.svg ./apps/api/assets/artmate-logo-square.svg
COPY --from=builder --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=node:node /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

RUN mkdir -p \
      /app/apps/api/uploads/colorings \
      /app/apps/api/private/colorings \
      /app/apps/api/private/workshops \
  && chown -R node:node \
      /app/apps/api/uploads \
      /app/apps/api/private

USER node
WORKDIR /app/apps/api

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3002/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
