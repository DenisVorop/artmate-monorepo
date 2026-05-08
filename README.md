# Turborepo starter

This Turborepo starter is maintained by the Turborepo core team.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `site`: main [Next.js](https://nextjs.org/) storefront
- `admin`: Artmate admin [Next.js](https://nextjs.org/) app
- `api`: Artmate backend API
- `@repo/ui`: a stub React component library workspace
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo build
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo build
yarn dlx turbo build
yarn exec turbo build
```

You can build a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo build --filter=site
```

Without global `turbo`:

```sh
npx turbo build --filter=site
yarn exec turbo build --filter=site
```

### Develop

To develop all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo dev
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo dev
yarn exec turbo dev
yarn exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo dev --filter=web
```

Without global `turbo`:

```sh
npx turbo dev --filter=web
yarn exec turbo dev --filter=web
yarn exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo login
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo login
yarn exec turbo login
yarn exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo link
```

Without global `turbo`:

```sh
npx turbo link
yarn exec turbo link
yarn exec turbo link
```

## Production Deploy

Production is deployed from GitHub Actions to a VPS by SSH. Runtime configuration is passed to the server as one `.env` file and is used by `docker-compose.prod.yml`.

GitHub secrets are configured in:

```text
Settings -> Environments -> production -> Environment secrets
```

### Required GitHub Secrets

| Secret | Where to get it |
| --- | --- |
| `PRODUCTION_HOST` | VPS IP address, for example `193.233.244.12`. |
| `PRODUCTION_USER` | SSH user on the VPS, currently `codex`. |
| `PRODUCTION_SSH_KEY` | Private deploy SSH key. Generate it locally, add the public key to `/home/codex/.ssh/authorized_keys` on the VPS, and paste the private key into this secret. |
| `PRODUCTION_ENV_FILE` | Full production `.env` content. Use `.env.example` as the base and replace placeholders with real values. |

### Optional GitHub Secrets

These are needed only if GHCR packages are private:

| Secret | Where to get it |
| --- | --- |
| `GHCR_USERNAME` | GitHub username that can read packages, for example `DenisVorop`. |
| `GHCR_READ_TOKEN` | GitHub Personal Access Token with `read:packages`. The VPS uses it for `docker pull` from GHCR. |

Do not add `GITHUB_TOKEN` manually. GitHub Actions provides it automatically.

### Generate Deploy SSH Key

Generate a dedicated key on your local machine:

```bash
ssh-keygen -t ed25519 -C "artmate-github-actions-deploy" -f ~/.ssh/artmate-github-actions-deploy -N ""
```

Add the public key to the VPS:

```bash
cat ~/.ssh/artmate-github-actions-deploy.pub
```

Paste the output into:

```text
/home/codex/.ssh/authorized_keys
```

Add the private key to GitHub as `PRODUCTION_SSH_KEY`:

```bash
cat ~/.ssh/artmate-github-actions-deploy
```

Paste the whole block, including:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

### Build PRODUCTION_ENV_FILE

Use `.env.example` as the source of truth. For production deploy, the required values are:

```env
ACME_EMAIL=admin@art-mate.ru

POSTGRES_DB=artmate
POSTGRES_USER=artmate
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgresql://artmate:change-me@postgres:5432/artmate

SITE_URL=https://www.art-mate.ru
ADMIN_URL=https://admin.art-mate.ru
API_PUBLIC_URL=https://api.art-mate.ru
API_BASE_URL=http://api:3002
NEXT_PUBLIC_SITE_URL=https://www.art-mate.ru
AUTH_SUCCESS_REDIRECT_URL=https://www.art-mate.ru
CORS_ORIGIN=https://www.art-mate.ru,https://admin.art-mate.ru
SWAGGER_ENABLED=false

AUTH_JWT_SECRET=change-me
```

The PostgreSQL database and user are created automatically by the `postgres` Docker image on the first start from:

```env
POSTGRES_DB=artmate
POSTGRES_USER=artmate
POSTGRES_PASSWORD=change-me
```

`DATABASE_URL` must use the same password:

```env
DATABASE_URL=postgresql://artmate:change-me@postgres:5432/artmate
```

If `POSTGRES_PASSWORD` contains characters like `@`, `:`, `/`, or `#`, URL-encode it in `DATABASE_URL`. To avoid this during setup, use a password with letters, digits, hyphens, and underscores.

Generate safe random values:

```bash
openssl rand -hex 24
openssl rand -hex 32
```

Use the first value for `POSTGRES_PASSWORD` and the second for `AUTH_JWT_SECRET`.

### Password Login

The API supports a password login backed by env variables. In production, use a hash, not a plain password:

```env
AUTH_PASSWORD_LOGIN=admin
AUTH_PASSWORD_EMAIL=admin@art-mate.ru
AUTH_PASSWORD_NAME=Admin
AUTH_PASSWORD_HASH=scrypt:...
AUTH_PASSWORD_ROLES=admin,customer
```

Generate `AUTH_PASSWORD_HASH` locally:

```bash
node -e 'const crypto=require("node:crypto"); const password=process.argv[1]; if(!password){throw new Error("Password argument is required")} const salt=crypto.randomBytes(16).toString("hex"); crypto.scrypt(password,salt,64,(error,key)=>{ if(error) throw error; console.log(`scrypt:${salt}:${key.toString("hex")}`); });' 'your-password'
```

`AUTH_PASSWORD` is for local development only. Do not put it in `PRODUCTION_ENV_FILE`.

### Optional Provider Secrets

These values can stay empty for a basic deploy, but related features will not work until they are set:

```env
YANDEX_OAUTH_CLIENT_ID=
YANDEX_OAUTH_CLIENT_SECRET=
YANDEX_OAUTH_REDIRECT_URI=https://api.art-mate.ru/auth/oauth/yandex/callback

OZON_API=
OZON_API_KEY=
OZON_CLIENT_ID=
OZON_LOGISTICS_MODE=mock
OZON_OAUTH_ACCESS_TYPE=offline
OZON_OAUTH_CLIENT_ID=
OZON_OAUTH_CLIENT_SECRET=
OZON_OAUTH_PROMPT=consent
OZON_OAUTH_REDIRECT_URI=https://api.art-mate.ru/ozon/oauth/callback
OZON_OAUTH_REFRESH_TOKEN=
OZON_OAUTH_SCOPE=

TELEGRAM_BOT_TOKEN=
TELEGRAM_CONTACTS_CHAT_ID=
TELEGRAM_ORDERS_CHAT_ID=
TELEGRAM_MINI_APP_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEB_APP_URL=https://www.art-mate.ru
```

Provider sources:

- `YANDEX_*`: Yandex OAuth application settings.
- `OZON_API_KEY` and `OZON_CLIENT_ID`: Ozon Seller API settings.
- `OZON_OAUTH_*`: Ozon OAuth application and OAuth flow.
- `TELEGRAM_BOT_TOKEN`: BotFather token for contact and order notifications.
- `TELEGRAM_CONTACTS_CHAT_ID`: target Telegram chat id for contact form messages.
- `TELEGRAM_ORDERS_CHAT_ID`: target Telegram chat id for order notifications, falls back to `TELEGRAM_CONTACTS_CHAT_ID`.
- `TELEGRAM_MINI_APP_BOT_TOKEN`: BotFather token for the Mini App bot served by `apps/tg`.
- `TELEGRAM_WEBHOOK_SECRET`: secret path segment for the Mini App bot webhook.
- `TELEGRAM_WEB_APP_URL`: Mini App URL opened by the Telegram bot.

If any real secret was pasted into chat, logs, or committed by mistake, rotate it in the provider dashboard before production use.

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)
