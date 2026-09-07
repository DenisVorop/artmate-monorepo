import type { AnalyticsWindow } from "./types";

const clientIdStorageKey = "artmate:yandex:client-id";
const yclidStorageKey = "artmate:yandex:yclid";
const yandexIdentifierPattern = /^[0-9]{1,128}$/;
const attributionTtlMs = 21 * 24 * 60 * 60 * 1000;

type StoredAttribution = {
  value: string;
  capturedAt: number;
};

export type YandexAttribution = {
  clientId?: string;
  yclid?: string;
};

export function readYandexAttribution(): YandexAttribution {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const clientId = readStoredIdentifier(clientIdStorageKey);
    const yclid = readStoredIdentifier(yclidStorageKey);

    return {
      ...(clientId ? { clientId } : {}),
      ...(yclid ? { yclid } : {}),
    };
  } catch {
    return {};
  }
}

export function captureYandexAttribution(counterId: number) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const yclid = normalizeYandexIdentifier(new URL(window.location.href).searchParams.get("yclid"));

    if (yclid) {
      writeStoredIdentifier(yclidStorageKey, yclid);
    }

    (window as AnalyticsWindow).ym?.(counterId, "getClientID", (value: unknown) => {
      const clientId = normalizeYandexIdentifier(value);

      if (clientId) {
        try {
          writeStoredIdentifier(clientIdStorageKey, clientId);
        } catch {
          // Attribution must not interrupt browsing when storage is blocked.
        }
      }
    });
  } catch {
    // URL and storage access may be blocked by browser privacy settings.
  }
}

function readStoredIdentifier(key: string) {
  const stored = window.localStorage.getItem(key);

  if (stored === null) {
    return undefined;
  }

  try {
    const record = JSON.parse(stored) as Partial<StoredAttribution>;
    const now = Date.now();
    const value = normalizeYandexIdentifier(record.value);

    if (
      !value ||
      typeof record.capturedAt !== "number" ||
      !Number.isFinite(record.capturedAt) ||
      record.capturedAt > now ||
      now - record.capturedAt > attributionTtlMs
    ) {
      window.localStorage.removeItem(key);
      return undefined;
    }

    return value;
  } catch {
    window.localStorage.removeItem(key);
    return undefined;
  }
}

function writeStoredIdentifier(key: string, value: string) {
  window.localStorage.setItem(
    key,
    JSON.stringify({ value, capturedAt: Date.now() } satisfies StoredAttribution),
  );
}

function normalizeYandexIdentifier(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return yandexIdentifierPattern.test(normalized) ? normalized : undefined;
}
