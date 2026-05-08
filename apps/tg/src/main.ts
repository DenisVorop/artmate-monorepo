import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

const defaultPort = 3004;
const defaultWebAppUrl = "https://www.art-mate.ru";
const maxBodySizeBytes = 512 * 1024;
const telegramRequestTimeoutMs = 10000;

type TelegramChat = {
  id: number | string;
  type?: string;
};

type TelegramUser = {
  first_name?: string;
  id: number;
  is_bot?: boolean;
  username?: string;
};

type TelegramMessage = {
  chat: TelegramChat;
  from?: TelegramUser;
  message_id: number;
  text?: string;
};

type TelegramUpdate = {
  callback_query?: {
    data?: string;
    from: TelegramUser;
    id: string;
    message?: TelegramMessage;
  };
  message?: TelegramMessage;
  update_id: number;
};

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(getPort(), () => {
  console.log(`Telegram bot service listening on port ${getPort()}`);
});

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
) {
  try {
    const pathname = getPathname(request);

    if (request.method === "GET" && pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const webhookSecret = getWebhookSecretFromPath(pathname);

    if (!webhookSecret) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    if (webhookSecret !== getRequiredEnv("TELEGRAM_WEBHOOK_SECRET")) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }

    const update = parseTelegramUpdate(await readJsonBody(request));
    await handleTelegramUpdate(update);
    sendJson(response, 200, { ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Telegram bot error";
    const status = message.includes("too large") ? 413 : 500;

    sendJson(response, status, { error: message });
  }
}

async function handleTelegramUpdate(update: TelegramUpdate) {
  if (update.message) {
    await handleMessage(update.message);
  }
}

async function handleMessage(message: TelegramMessage) {
  const text = message.text?.trim();

  if (!text || text.startsWith("/start") || text.startsWith("/app")) {
    await sendOpenAppMessage(message.chat.id, message.from?.first_name);
    return;
  }

  await sendOpenAppMessage(message.chat.id, message.from?.first_name);
}

async function sendOpenAppMessage(
  chatId: TelegramChat["id"],
  firstName?: string,
) {
  const greeting = firstName ? `${firstName}, откройте Artmate` : "Откройте Artmate";

  await sendTelegramMethod("sendMessage", {
    chat_id: chatId,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть Artmate",
            web_app: {
              url: getWebAppUrl(),
            },
          },
        ],
      ],
    },
    text: greeting,
  });
}

async function sendTelegramMethod(
  method: string,
  body: Record<string, unknown>,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), telegramRequestTimeoutMs);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${getRequiredEnv("TELEGRAM_MINI_APP_BOT_TOKEN")}/${method}`,
      {
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Telegram API request failed: ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bodySize = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bodySize += buffer.length;

    if (bodySize > maxBodySizeBytes) {
      throw new Error("Request body is too large");
    }

    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function parseTelegramUpdate(value: unknown): TelegramUpdate {
  if (!isRecord(value) || typeof value.update_id !== "number") {
    throw new Error("Invalid Telegram update");
  }

  return value as TelegramUpdate;
}

function getPathname(request: IncomingMessage) {
  const host = request.headers.host ?? "localhost";
  const url = new URL(request.url ?? "/", `http://${host}`);

  return url.pathname;
}

function getWebhookSecretFromPath(pathname: string) {
  const match = /^\/telegram\/webhook\/([^/]+)$/.exec(pathname);

  return match?.[1];
}

function getWebAppUrl() {
  const rawUrl = process.env.TELEGRAM_WEB_APP_URL ?? process.env.SITE_URL ?? defaultWebAppUrl;

  try {
    return new URL(rawUrl).toString();
  } catch {
    return defaultWebAppUrl;
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  response.writeHead(status, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(body));
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function getPort() {
  const value = process.env.PORT;

  if (!value) {
    return defaultPort;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 0 || port >= 65536) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
