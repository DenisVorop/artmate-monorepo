const telegramUsernamePattern = /^[a-zA-Z0-9_]{5,32}$/;
const telegramShortLinkPattern = /^(?:www\.)?(?:t\.me|telegram\.me)\/(.+)$/i;

export function normalizeTelegramContact(value: string) {
  let candidate = value.trim();

  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);

      if (
        !["t.me", "telegram.me", "www.t.me", "www.telegram.me"].includes(
          url.hostname.toLowerCase(),
        ) ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash
      ) {
        return undefined;
      }

      candidate = url.pathname.replace(/^\/+|\/+$/g, "");
    } catch {
      return undefined;
    }
  } else {
    const shortLinkMatch = candidate.match(telegramShortLinkPattern);

    if (shortLinkMatch) {
      candidate = shortLinkMatch[1] ?? "";
    }
  }

  const username = candidate.replace(/^@/, "");

  return telegramUsernamePattern.test(username) ? `@${username}` : undefined;
}
