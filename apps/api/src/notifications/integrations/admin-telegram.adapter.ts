/** Renders a persisted admin notice using the existing administrative bot/chat.
 * Never renders raw provider responses, credentials or protected image URLs.
 */
export class AdminTelegramAdapter {
  static prepare(payload: Record<string, unknown>) {
    if (
      payload.kind !== "admin_notice" ||
      payload.contractVersion !== 1 ||
      typeof payload.title !== "string" ||
      !payload.title.trim() ||
      !Array.isArray(payload.lines) ||
      !payload.lines.every(
        (line): line is string => typeof line === "string",
      ) ||
      typeof payload.adminPath !== "string" ||
      !/^\/(?:orders|workshop-moderation\/[a-f0-9]{32})$/.test(
        payload.adminPath,
      ) ||
      typeof payload.actionLabel !== "string" ||
      !payload.actionLabel.trim()
    ) {
      throw new Error("Invalid admin notice contract");
    }

    const chatId =
      process.env.TELEGRAM_ORDERS_CHAT_ID?.trim() ||
      process.env.TELEGRAM_CONTACTS_CHAT_ID?.trim();
    if (!chatId)
      throw new Error("Administrative Telegram chat is not configured");
    const adminUrl = process.env.ADMIN_URL?.trim();
    if (!adminUrl) throw new Error("ADMIN_URL is not configured");
    const url = new URL(payload.adminPath, adminUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid ADMIN_URL protocol");
    }

    const text = [
      `<b>${escapeText(payload.title)}</b>`,
      "",
      ...payload.lines.map(escapeText),
    ].join("\n");
    if (text.length > 4096) throw new Error("Admin notice is too long");

    return {
      bot: "orders" as const,
      chatId,
      disableWebPagePreview: true,
      parseMode: "HTML" as const,
      text,
      replyMarkup: {
        inline_keyboard: [[{ text: payload.actionLabel, url: url.toString() }]],
      },
    };
  }
}

function escapeText(value: string) {
  return value
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
