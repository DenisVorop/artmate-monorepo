import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

const defaultPort = 3004;
const defaultApiInternalUrl = "http://localhost:3002";
const defaultTelegramApiBaseUrl = "https://api.telegram.org";
const defaultWebAppUrl = "https://www.art-mate.ru";
const maxBodySizeBytes = 512 * 1024;
const telegramRequestTimeoutMs = 10000;
const telegramApiRelayPath = "/telegram-api";
const linkAccountCallbackData = "link_account";

type TelegramChat = {
  id: number | string;
  type?: string;
};

type TelegramUser = {
  first_name?: string;
  id: number;
  is_bot?: boolean;
  last_name?: string;
  username?: string;
};

type TelegramContact = {
  first_name?: string;
  last_name?: string;
  phone_number: string;
  user_id?: number;
};

type TelegramMessage = {
  chat: TelegramChat;
  contact?: TelegramContact;
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

  void configureTelegramBot().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown Telegram setup error";

    console.error(`Telegram bot setup failed: ${message}`);
  });
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

    void handleTelegramUpdate(update).catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unknown Telegram bot error";

      console.error(`Telegram update ${update.update_id} failed: ${message}`);
    });

    sendJson(response, 200, { ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Telegram bot error";
    const status = message.includes("too large") ? 413 : 500;

    sendJson(response, status, { error: message });
  }
}

async function handleTelegramUpdate(update: TelegramUpdate) {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  if (update.message) {
    await handleMessage(update.message);
  }
}

async function handleMessage(message: TelegramMessage) {
  const text = message.text?.trim();

  if (message.contact) {
    await handleContact(message, message.contact);
    return;
  }

  if (text?.startsWith("/app")) {
    await sendOpenAppMessage(message.chat.id, message.from?.first_name);
    return;
  }

  if (isTelegramLinkCommand(text)) {
    await sendTelegramLinkMessage(message.chat.id, message.from?.first_name);
    return;
  }

  await sendHomeMessage(message.chat.id, message.from?.first_name);
}

async function handleCallbackQuery(
  callbackQuery: NonNullable<TelegramUpdate["callback_query"]>,
) {
  await sendTelegramMethod("answerCallbackQuery", {
    callback_query_id: callbackQuery.id,
  });

  if (!callbackQuery.message) {
    return;
  }

  if (callbackQuery.data === linkAccountCallbackData) {
    await sendTelegramLinkMessage(
      callbackQuery.message.chat.id,
      callbackQuery.from.first_name,
    );
    return;
  }

  await sendHomeMessage(
    callbackQuery.message.chat.id,
    callbackQuery.from.first_name,
  );
}

async function handleContact(
  message: TelegramMessage,
  contact: TelegramContact,
) {
  if (!message.from || contact.user_id !== message.from.id) {
    await sendTelegramMethod("sendMessage", {
      chat_id: message.chat.id,
      text: "Пожалуйста, нажмите кнопку ниже и поделитесь своим Telegram-контактом.",
    });
    await sendTelegramLinkMessage(message.chat.id, message.from?.first_name);
    return;
  }

  try {
    const linkCode = await createTelegramLinkCode({
      firstName: message.from.first_name ?? contact.first_name,
      lastName: message.from.last_name ?? contact.last_name,
      phone: contact.phone_number,
      telegramChatId: String(message.chat.id),
      telegramUserId: String(message.from.id),
      username: message.from.username,
    });

    await sendTelegramMethod("sendMessage", {
      chat_id: message.chat.id,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Открыть личный кабинет",
              web_app: {
                url: getAccountUrl(),
              },
            },
          ],
        ],
      },
      parse_mode: "MarkdownV2",
      text: [
        `${escapeMarkdownV2("Код привязки Artmate: ")}\`${linkCode.code}\``,
        "",
        escapeMarkdownV2(
          "Введите его в личном кабинете на сайте. Код действует 10 минут.",
        ),
      ].join("\n"),
    });
  } catch (error) {
    const messageText = getTelegramLinkErrorMessage(error);

    await sendTelegramMethod("sendMessage", {
      chat_id: message.chat.id,
      reply_markup: {
        remove_keyboard: true,
      },
      text: messageText,
    });
  }
}

async function sendHomeMessage(chatId: TelegramChat["id"], firstName?: string) {
  const greeting = firstName
    ? `${firstName}, выберите действие в Artmate`
    : "Выберите действие в Artmate";

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
        [
          {
            callback_data: linkAccountCallbackData,
            text: "Привязать Telegram",
          },
        ],
      ],
    },
    text: [
      greeting,
      "",
      "Здесь можно открыть сайт Artmate и привязать Telegram к личному кабинету для уведомлений.",
    ].join("\n"),
  });
}

async function sendTelegramLinkMessage(
  chatId: TelegramChat["id"],
  firstName?: string,
) {
  const greeting = firstName
    ? `${firstName}, привяжите Telegram к Artmate`
    : "Привяжите Telegram к Artmate";

  await sendTelegramMethod("sendMessage", {
    chat_id: chatId,
    reply_markup: {
      keyboard: [
        [
          {
            request_contact: true,
            text: "Поделиться телефоном",
          },
        ],
        [
          {
            text: "Открыть Artmate",
            web_app: {
              url: getWebAppUrl(),
            },
          },
        ],
      ],
      one_time_keyboard: true,
      resize_keyboard: true,
    },
    text: [
      greeting,
      "",
      "Так мы сможем отправлять уведомления о заказах, событиях и важных обновлениях. После контакта я пришлю код для личного кабинета.",
    ].join("\n"),
  });
}

async function sendOpenAppMessage(
  chatId: TelegramChat["id"],
  firstName?: string,
) {
  const greeting = firstName
    ? `${firstName}, откройте Artmate`
    : "Откройте Artmate";

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

async function configureTelegramBot() {
  await Promise.all([
    sendTelegramMethod("setMyCommands", {
      commands: [
        {
          command: "start",
          description: "Главное меню Artmate",
        },
        {
          command: "link",
          description: "Привязать Telegram",
        },
        {
          command: "app",
          description: "Открыть сайт Artmate",
        },
      ],
    }),
    sendTelegramMethod("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "Artmate",
        web_app: {
          url: getWebAppUrl(),
        },
      },
    }),
  ]);
}

async function sendTelegramMethod(
  method: string,
  body: Record<string, unknown>,
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    telegramRequestTimeoutMs,
  );

  try {
    const botToken = getRequiredEnv("TELEGRAM_MINI_APP_BOT_TOKEN");
    const response = await fetch(
      getTelegramBotMethodUrl(botToken, method),
      {
        body: JSON.stringify(body),
        headers: getTelegramRequestHeaders(botToken),
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

type TelegramLinkCodeRequest = {
  firstName?: string;
  lastName?: string;
  phone: string;
  telegramChatId: string;
  telegramUserId: string;
  username?: string;
};

type TelegramLinkCodeResponse = {
  code: string;
  expiresAt: string;
};

async function createTelegramLinkCode(body: TelegramLinkCodeRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    telegramRequestTimeoutMs,
  );

  try {
    const response = await fetch(
      `${getApiInternalUrl()}/auth/telegram/link/code`,
      {
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
          "x-artmate-csrf": "1",
          "x-telegram-link-service-token": getRequiredEnv(
            "TELEGRAM_LINK_SERVICE_TOKEN",
          ),
        },
        method: "POST",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }

    return (await response.json()) as TelegramLinkCodeResponse;
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
  const rawUrl =
    process.env.TELEGRAM_WEB_APP_URL ??
    process.env.SITE_URL ??
    defaultWebAppUrl;

  try {
    return new URL(rawUrl).toString();
  } catch {
    return defaultWebAppUrl;
  }
}

function getAccountUrl() {
  try {
    return new URL("/account", getWebAppUrl()).toString();
  } catch {
    return defaultWebAppUrl;
  }
}

function getApiInternalUrl() {
  const rawUrl = process.env.API_INTERNAL_URL ?? defaultApiInternalUrl;

  try {
    return new URL(rawUrl).toString().replace(/\/+$/, "");
  } catch {
    return defaultApiInternalUrl;
  }
}

function getTelegramBotMethodUrl(botToken: string, method: string) {
  const baseUrl = getTelegramApiBaseUrl();

  if (isDirectTelegramApiBaseUrl(baseUrl)) {
    return `${baseUrl}/bot${botToken}/${method}`;
  }

  return `${baseUrl}/${method}`;
}

function getTelegramRequestHeaders(botToken: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const relayToken = getTelegramApiRelayToken();

  if (relayToken) {
    headers.authorization = `Bearer ${relayToken}`;
    headers["x-telegram-bot-token"] = botToken;
  }

  return headers;
}

function getTelegramApiBaseUrl() {
  const explicitBaseUrl = normalizeBaseUrl(process.env.TELEGRAM_API_BASE_URL);

  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const derivedBaseUrl = deriveTelegramApiBaseUrlFromOpenAiBaseUrl(
    process.env.OPENAI_BASE_URL,
  );

  return derivedBaseUrl ?? defaultTelegramApiBaseUrl;
}

function getTelegramApiRelayToken() {
  if (isDirectTelegramApiBaseUrl(getTelegramApiBaseUrl())) {
    return undefined;
  }

  const token =
    process.env.TELEGRAM_API_RELAY_TOKEN?.trim() ||
    process.env.OPENAI_RELAY_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "TELEGRAM_API_RELAY_TOKEN or OPENAI_RELAY_TOKEN is not configured",
    );
  }

  return token;
}

function deriveTelegramApiBaseUrlFromOpenAiBaseUrl(
  value: string | undefined,
) {
  const text = value?.trim();

  if (!text) {
    return undefined;
  }

  try {
    const url = new URL(text);

    if (url.hostname === "api.openai.com") {
      return undefined;
    }

    url.pathname = telegramApiRelayPath;
    url.search = "";
    url.hash = "";

    return normalizeBaseUrl(url.toString());
  } catch {
    return undefined;
  }
}

function normalizeBaseUrl(value: string | undefined) {
  const text = value?.trim();

  if (!text) {
    return undefined;
  }

  return text.replace(/\/+$/, "");
}

function isDirectTelegramApiBaseUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      url.origin === defaultTelegramApiBaseUrl &&
      (url.pathname === "" || url.pathname === "/")
    );
  } catch {
    return false;
  }
}

async function getApiErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown };

    if (typeof body.message === "string") {
      return body.message;
    }

    if (Array.isArray(body.message)) {
      return body.message.join(", ");
    }
  } catch {
    return `API request failed: ${response.status}`;
  }

  return `API request failed: ${response.status}`;
}

function getTelegramLinkErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("already linked")) {
    return "Этот Telegram уже привязан к аккаунту Artmate. Сначала отвяжите его в личном кабинете.";
  }

  if (message.includes("temporarily unavailable")) {
    return "Код уже был отправлен недавно. Попробуйте запросить новый код чуть позже.";
  }

  return "Не удалось создать код привязки. Попробуйте ещё раз позже.";
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

function isTelegramLinkCommand(text: string | undefined) {
  return Boolean(text?.startsWith("/link") || text?.startsWith("/start link"));
}

function escapeMarkdownV2(value: string) {
  return value.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
