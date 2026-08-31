import { parsePromoCode } from "./promo-code";

const storageKey = "artmate:selected-promocode";

export type StoredPromoCode = {
  cartId: string;
  code: string;
};

type PromoCodeStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

let memoryValue: StoredPromoCode | undefined;
let sessionOverride: StoredPromoCode | null | undefined;

export function readStoredPromoCode(storage: PromoCodeStorage | null = getBrowserStorage()) {
  if (sessionOverride !== undefined) {
    if (sessionOverride === null) {
      try {
        storage?.removeItem(storageKey);

        if (storage) {
          sessionOverride = undefined;
        }
      } catch {
        return undefined;
      }

      return undefined;
    }

    const override = sessionOverride;

    try {
      storage?.setItem(storageKey, JSON.stringify(override));

      if (storage) {
        sessionOverride = undefined;
      }
    } catch {
      return override;
    }

    return override;
  }

  if (!storage) {
    return memoryValue;
  }

  let serialized: string | null;

  try {
    serialized = storage.getItem(storageKey);
  } catch {
    return memoryValue;
  }

  if (serialized === null) {
    memoryValue = undefined;
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(serialized);

    if (!parsed || typeof parsed !== "object") {
      clearStoredPromoCode(storage);
      return undefined;
    }

    const { cartId, code: storedCode } = parsed as Partial<StoredPromoCode>;
    const code = parsePromoCode(storedCode);

    if (typeof cartId !== "string" || !cartId || !code) {
      clearStoredPromoCode(storage);
      return undefined;
    }

    memoryValue = { cartId, code };
    return memoryValue;
  } catch {
    clearStoredPromoCode(storage);
    return undefined;
  }
}

export function readCartPromoCode(
  cartId: string,
  hasItems: boolean,
  storage: PromoCodeStorage | null = getBrowserStorage(),
) {
  const stored = readStoredPromoCode(storage);

  if (!hasItems || stored?.cartId !== cartId) {
    clearStoredPromoCode(storage);
    return undefined;
  }

  return stored.code;
}

export function writeStoredPromoCode(
  value: StoredPromoCode,
  storage: PromoCodeStorage | null = getBrowserStorage(),
) {
  const code = parsePromoCode(value.code);

  if (!value.cartId || !code) {
    return false;
  }

  memoryValue = { cartId: value.cartId, code };

  if (!storage) {
    sessionOverride = memoryValue;
    return false;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(memoryValue));
    sessionOverride = undefined;
  } catch {
    sessionOverride = memoryValue;
    return false;
  }

  return true;
}

export function clearStoredPromoCode(storage: PromoCodeStorage | null = getBrowserStorage()) {
  memoryValue = undefined;

  if (!storage) {
    sessionOverride = null;
    return false;
  }

  try {
    storage.removeItem(storageKey);
    sessionOverride = undefined;
  } catch {
    sessionOverride = null;
    return false;
  }

  return true;
}

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
