export const cookieConsentStorageKey = "artmate_cookie_consent_v1";

const cookieConsentAcceptedValue = "accepted";
const listeners = new Set<() => void>();
let memoryAccepted = false;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function getCookieConsentSnapshot(storage?: StorageLike) {
  const resolvedStorage = storage ?? getLocalStorage();
  if (!resolvedStorage) {
    return memoryAccepted;
  }

  try {
    return (
      memoryAccepted ||
      resolvedStorage.getItem(cookieConsentStorageKey) === cookieConsentAcceptedValue
    );
  } catch {
    return memoryAccepted;
  }
}

export function acceptCookieConsent(storage?: StorageLike) {
  memoryAccepted = true;
  const resolvedStorage = storage ?? getLocalStorage();

  try {
    resolvedStorage?.setItem(cookieConsentStorageKey, cookieConsentAcceptedValue);
  } catch {
    // The in-memory consent above keeps all subscribers coordinated.
  }

  for (const listener of listeners) {
    listener();
  }
}

function getLocalStorage() {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function subscribeCookieConsent(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key === cookieConsentStorageKey) {
      memoryAccepted = event.newValue === cookieConsentAcceptedValue;
      listener();
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}
