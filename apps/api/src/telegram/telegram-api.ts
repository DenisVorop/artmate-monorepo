const defaultTelegramApiBaseUrl = "https://api.telegram.org";
const telegramApiRelayPath = "/telegram-api";

export function getTelegramBotMethodUrl(botToken: string, method: string) {
  const baseUrl = getTelegramApiBaseUrl();

  if (isDirectTelegramApiBaseUrl(baseUrl)) {
    return `${baseUrl}/bot${botToken}/${method}`;
  }

  return `${baseUrl}/${method}`;
}

export function getTelegramRequestHeaders(botToken: string) {
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
