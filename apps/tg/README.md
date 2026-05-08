# Artmate Telegram Bot

This workspace runs the Artmate Telegram bot service. It receives Telegram
webhook updates and sends a Mini App button that opens the main Artmate site.

## Local development

Run the main site and the bot service from the repository root:

```bash
yarn workspace site dev
yarn workspace tg dev
```

The bot service listens on `http://localhost:3004`.

Required environment:

```bash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
TELEGRAM_WEB_APP_URL=https://www.art-mate.ru
```

## Bot setup

1. Create a bot in `BotFather`.
2. Deploy this service to an HTTPS URL.
3. Set the webhook to `/telegram/webhook/<TELEGRAM_WEBHOOK_SECRET>`.
4. Configure the bot menu button to open `TELEGRAM_WEB_APP_URL`.

The service sends the same `TELEGRAM_WEB_APP_URL` through the `/start` inline
keyboard button.
