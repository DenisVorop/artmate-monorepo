# Artmate AI Relay

Minimal HTTP relay for server-side OpenAI API calls from a supported region.

The relay accepts only `POST /v1/responses` and forwards the request to OpenAI
using `OPENAI_API_KEY` stored on the relay host. The main Artmate API should use
`OPENAI_BASE_URL=https://<relay-host>/v1` and `OPENAI_RELAY_TOKEN=<AI_RELAY_TOKEN>`.

## Environment

For local development the relay listens on `http://localhost:3005` by default.
Set `PORT` to override it. Production Docker and GitHub deploy configuration set
`PORT=3004` explicitly.

```bash
AI_RELAY_DOMAIN=77-221-158-124.sslip.io
AI_RELAY_TOKEN=change-me
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
```

## GitHub deploy

The relay is deployed by `.github/workflows/deploy-ai-relay.yml`.

Required GitHub environment secrets:

- `AI_RELAY_HOST` - Finnish VPS host.
- `AI_RELAY_DOMAIN` - public HTTPS hostname, for example `77-221-158-124.sslip.io`.
- `AI_RELAY_TOKEN` - shared secret used by the main Artmate API as `OPENAI_RELAY_TOKEN`.
- `OPENAI_API_KEY` - real OpenAI API key used only by the relay.

Optional secrets:

- `AI_RELAY_USER` - SSH user on the Finnish VPS. Defaults to `PRODUCTION_USER`.
- `AI_RELAY_SSH_KEY` - private SSH key for the relay VPS. Defaults to `PRODUCTION_SSH_KEY`.
- `AI_RELAY_ENV_FILE` - bulk env file. Individual secrets above override duplicate keys.
- `AI_RELAY_OPENAI_BASE_URL` - defaults to `https://api.openai.com/v1`.
- `OPENAI_ORGANIZATION`
- `OPENAI_PROJECT`

The main production API still needs:

```bash
OPENAI_BASE_URL=https://77-221-158-124.sslip.io/v1
OPENAI_RELAY_TOKEN=<same-as-AI_RELAY_TOKEN>
```

## Docker

```bash
docker run -d \
  --name artmate-ai-relay \
  --restart unless-stopped \
  --env-file .env \
  -p 3004:3004 \
  ghcr.io/denisvorop/artmate-monorepo-ai-relay:latest
```

Expose it through HTTPS on the Finnish VPS, then configure production API:

```bash
OPENAI_BASE_URL=https://relay.example.com/v1
OPENAI_RELAY_TOKEN=<same-as-AI_RELAY_TOKEN>
```
