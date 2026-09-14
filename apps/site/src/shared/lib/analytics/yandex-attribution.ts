import type { AnalyticsWindow, YandexMetrikaFunction } from "./types";

const clientIdStorageKey = "artmate:yandex:client-id";
const yclidStorageKey = "artmate:yandex:yclid";
const yandexIdentifierPattern = /^[0-9]{1,128}$/;
const attributionTtlMs = 21 * 24 * 60 * 60 * 1000;
const clientIdWaitMs = 800;

type StoredAttribution = {
  value: string;
  capturedAt: number;
};

type AttributionState = {
  identifiers: Map<string, StoredAttribution>;
  counterId?: number;
  lookup?: {
    counterId: number;
    ym: YandexMetrikaFunction;
    promise: Promise<void>;
    waiting: boolean;
    cancel: () => void;
  };
};

const browserStates = new WeakMap<AnalyticsWindow, AttributionState>();

export type YandexAttribution = {
  clientId?: string;
  yclid?: string;
};

export function readYandexAttribution(): YandexAttribution {
  return typeof window === "undefined" ? {} : readAttribution(window as AnalyticsWindow);
}

export async function resolveYandexAttribution(): Promise<YandexAttribution> {
  if (typeof window === "undefined") {
    return {};
  }

  const analyticsWindow = window as AnalyticsWindow;
  captureYclid(analyticsWindow);
  const counterId = getCounterId(analyticsWindow);

  if (counterId) {
    await requestClientId(analyticsWindow, counterId);
  }

  // A new snapshot prevents a late third-party callback from changing the order DTO.
  return readAttribution(analyticsWindow);
}

export function captureYandexAttribution(counterId: number) {
  if (typeof window === "undefined") {
    return;
  }

  const analyticsWindow = window as AnalyticsWindow;
  captureYclid(analyticsWindow);

  if (Number.isSafeInteger(counterId) && counterId > 0) {
    getState(analyticsWindow).counterId = counterId;
    void requestClientId(analyticsWindow, counterId);
  }
}

function getState(analyticsWindow: AnalyticsWindow) {
  let state = browserStates.get(analyticsWindow);

  if (!state) {
    state = { identifiers: new Map() };
    browserStates.set(analyticsWindow, state);
  }

  return state;
}

function getCounterId(analyticsWindow: AnalyticsWindow) {
  try {
    const rawCounterId = analyticsWindow.document
      ?.getElementById("yandex-metrika")
      ?.getAttribute("data-counter-id");
    const counterId = Number(rawCounterId);

    if (Number.isSafeInteger(counterId) && counterId > 0) {
      return counterId;
    }
  } catch {
    // The initializer also knows the configured counter when DOM access is unavailable.
  }

  return getState(analyticsWindow).counterId;
}

function requestClientId(analyticsWindow: AnalyticsWindow, counterId: number): Promise<void> {
  let ym: YandexMetrikaFunction | undefined;

  try {
    ym = analyticsWindow.ym;
  } catch {
    return Promise.resolve();
  }

  if (typeof ym !== "function") {
    return Promise.resolve();
  }

  const state = getState(analyticsWindow);

  if (state.lookup?.counterId === counterId && state.lookup.ym === ym && state.lookup.waiting) {
    return state.lookup.promise;
  }

  state.lookup?.cancel();
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  const lookup = { counterId, ym, promise, waiting: true, cancel };
  state.lookup = lookup;
  const timer = setTimeout(finishWaiting, clientIdWaitMs);

  function finishWaiting() {
    if (!lookup.waiting) {
      return;
    }

    lookup.waiting = false;
    clearTimeout(timer);
    resolve();
  }

  function cancel() {
    finishWaiting();

    // Keep at most one owned bootstrap callback; never remove another consumer's calls.
    try {
      const queue = lookup.ym.a;

      if (Array.isArray(queue)) {
        for (let index = queue.length - 1; index >= 0; index -= 1) {
          const call = queue[index];

          if (call?.[0] === counterId && call[1] === "getClientID" && call[2] === onClientId) {
            queue.splice(index, 1);
          }
        }
      }
    } catch {
      // A third-party queue can be unavailable or read-only.
    }

    if (state.lookup === lookup) {
      delete state.lookup;
    }
  }

  function onClientId(value: unknown) {
    if (state.lookup !== lookup) {
      return;
    }

    // A slow SDK may resolve after checkout's deadline. Cache it for future requests,
    // but a superseded lookup must never overwrite a newer identifier.
    const clientId = normalizeYandexIdentifier(value);

    if (clientId) {
      writeStoredIdentifier(analyticsWindow, clientIdStorageKey, clientId);
    }

    // The SDK may be iterating its bootstrap queue here; never splice it in a callback.
    finishWaiting();
    delete state.lookup;
  }

  try {
    ym(counterId, "getClientID", onClientId);
  } catch {
    cancel();
  }

  return promise;
}

function captureYclid(analyticsWindow: AnalyticsWindow) {
  try {
    const yclid = normalizeYandexIdentifier(
      new URL(analyticsWindow.location.href).searchParams.get("yclid"),
    );

    if (yclid) {
      writeStoredIdentifier(analyticsWindow, yclidStorageKey, yclid);
    }
  } catch {
    // URL/storage restrictions must not prevent the independent getClientID lookup.
  }
}

function readAttribution(analyticsWindow: AnalyticsWindow): YandexAttribution {
  const clientId = readStoredIdentifier(analyticsWindow, clientIdStorageKey);
  const yclid = readStoredIdentifier(analyticsWindow, yclidStorageKey);

  return {
    ...(clientId ? { clientId } : {}),
    ...(yclid ? { yclid } : {}),
  };
}

function readStoredIdentifier(analyticsWindow: AnalyticsWindow, key: string) {
  const identifiers = getState(analyticsWindow).identifiers;
  let record = parseStoredIdentifier(identifiers.get(key));

  try {
    const stored = analyticsWindow.localStorage.getItem(key);

    if (stored !== null) {
      const parsed = parseStoredIdentifier(JSON.parse(stored));

      if (parsed && (!record || parsed.capturedAt > record.capturedAt)) {
        record = parsed;
      } else if (!parsed) {
        analyticsWindow.localStorage.removeItem(key);
      }
    }
  } catch {
    try {
      analyticsWindow.localStorage.removeItem(key);
    } catch {
      // Keep the in-memory record with its original TTL when storage is blocked.
    }
  }

  if (record) {
    identifiers.set(key, record);
  } else {
    identifiers.delete(key);
  }

  return record?.value;
}

function parseStoredIdentifier(input: unknown): StoredAttribution | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const record = input as Partial<StoredAttribution>;
  const value = normalizeYandexIdentifier(record.value);
  const now = Date.now();

  if (
    !value ||
    typeof record.capturedAt !== "number" ||
    !Number.isFinite(record.capturedAt) ||
    record.capturedAt > now ||
    now - record.capturedAt > attributionTtlMs
  ) {
    return undefined;
  }

  return { value, capturedAt: record.capturedAt };
}

function writeStoredIdentifier(analyticsWindow: AnalyticsWindow, key: string, value: string) {
  const record = { value, capturedAt: Date.now() };
  getState(analyticsWindow).identifiers.set(key, record);

  try {
    analyticsWindow.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // The current page can still use attribution without persistent browser storage.
  }
}

function normalizeYandexIdentifier(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return yandexIdentifierPattern.test(normalized) ? normalized : undefined;
}
