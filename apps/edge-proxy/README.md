# Artmate Edge Proxy

Public edge service for Artmate traffic that must enter from a supported region.

It currently handles:

- `POST /v1/responses`: forwards server-side OpenAI API calls using
  `OPENAI_API_KEY` stored on the proxy host.
- `/content-assistant/telegram/*`: proxies content assistant Telegram webhooks
  to `https://api.art-mate.ru`.
- `/telegram/*`: proxies Mini App bot webhooks to `https://tg.art-mate.ru`.

The main Artmate API should use
`OPENAI_BASE_URL=https://<proxy-host>/v1` and
`OPENAI_RELAY_TOKEN=<EDGE_PROXY_TOKEN>`.

## Environment

For local development the proxy listens on `http://localhost:3005` by default.
Set `PORT` to override it. Production Docker and GitHub deploy configuration set
`PORT=3004` explicitly.

```bash
EDGE_PROXY_DOMAIN=77-221-158-124.sslip.io
EDGE_PROXY_TOKEN=change-me
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
```

## GitHub deploy

The proxy is deployed by `.github/workflows/deploy-edge-proxy.yml`.

Required GitHub environment secrets:

- `EDGE_PROXY_HOST` - Finnish VPS host.
- `EDGE_PROXY_DOMAIN` - public HTTPS hostname, for example `77-221-158-124.sslip.io`.
- `EDGE_PROXY_TOKEN` - shared secret used by the main Artmate API as `OPENAI_RELAY_TOKEN`.
- `OPENAI_API_KEY` - real OpenAI API key used only by the proxy.

Optional secrets:

- `EDGE_PROXY_USER` - SSH user on the Finnish VPS. Defaults to `PRODUCTION_USER`.
- `EDGE_PROXY_SSH_KEY` - private SSH key for the proxy VPS. Defaults to `PRODUCTION_SSH_KEY`.
- `EDGE_PROXY_ENV_FILE` - bulk env file. Individual secrets above override duplicate keys.
- `EDGE_PROXY_OPENAI_BASE_URL` - defaults to `https://api.openai.com/v1`.
- `OPENAI_ORGANIZATION`
- `OPENAI_PROJECT`

The deploy workflow still accepts the old `AI_RELAY_*` secret names as a
fallback during migration.

The main production API still needs:

```bash
OPENAI_BASE_URL=https://77-221-158-124.sslip.io/v1
OPENAI_RELAY_TOKEN=<same-as-EDGE_PROXY_TOKEN>
```

Telegram Mini App bot webhook should point at the edge proxy domain, not the
regional `tg.art-mate.ru` host:

```bash
curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_MINI_APP_BOT_TOKEN}/setWebhook" \
  -H "content-type: application/json" \
  -d "{\"url\":\"https://${EDGE_PROXY_DOMAIN}/telegram/webhook/${TELEGRAM_WEBHOOK_SECRET}\"}"
```

## Docker

```bash
docker run -d \
  --name artmate-edge-proxy \
  --restart unless-stopped \
  --env-file .env \
  -p 3004:3004 \
  ghcr.io/denisvorop/artmate-monorepo-edge-proxy:latest
```

Expose it through HTTPS on the Finnish VPS, then configure production API:

```bash
OPENAI_BASE_URL=https://proxy.example.com/v1
OPENAI_RELAY_TOKEN=<same-as-EDGE_PROXY_TOKEN>
```
