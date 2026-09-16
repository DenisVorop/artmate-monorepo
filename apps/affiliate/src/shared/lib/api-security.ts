export const apiCsrfHeader = {
  "x-artmate-csrf": "1",
} as const;

export function getForwardedIpHeaders(headerStore: Headers) {
  const forwardedFor = normalizeHeaderIp(
    headerStore.get("x-forwarded-for")?.split(",")[0],
  );
  const realIp = normalizeHeaderIp(headerStore.get("x-real-ip"));

  return {
    ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    ...(realIp ? { "x-real-ip": realIp } : {}),
  };
}

function normalizeHeaderIp(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  if (
    !normalizedValue ||
    normalizedValue.toLowerCase() === "unknown" ||
    normalizedValue.includes("\n") ||
    normalizedValue.includes("\r")
  ) {
    return undefined;
  }

  return normalizedValue;
}
