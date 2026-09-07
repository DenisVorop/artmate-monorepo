import type { CheckoutDeliverySelection } from "./checkout-form";

const pickupSelectionStorageKeyPrefix = "artmate:checkout-pickup:";
const pickupSelectionTtlMs = 24 * 60 * 60 * 1000;
const technicalIdMaxLength = 160;
const cityCodeMax = 2_147_483_647;

type PersistedPickupSelection = CheckoutDeliverySelection & { expiresAt: number };

export function readPersistedPickupSelection(
  cartId: string,
  now = Date.now(),
): CheckoutDeliverySelection | undefined {
  const storageKey = getPickupSelectionStorageKey(cartId);

  if (typeof window === "undefined" || !storageKey || !Number.isFinite(now)) return undefined;

  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "null") as unknown;

    if (
      !isPersistedPickupSelection(value) ||
      value.expiresAt <= now ||
      value.expiresAt > now + pickupSelectionTtlMs
    ) {
      removeStorageItem(storageKey);
      return undefined;
    }

    return value.provider === "cdek"
      ? {
          cityCode: value.cityCode,
          pickupPointId: value.pickupPointId,
          provider: value.provider,
        }
      : { pickupPointId: value.pickupPointId, provider: value.provider };
  } catch {
    removeStorageItem(storageKey);
    return undefined;
  }
}

export function writePersistedPickupSelection(
  cartId: string,
  selection: CheckoutDeliverySelection,
  now = Date.now(),
) {
  const storageKey = getPickupSelectionStorageKey(cartId);

  if (
    typeof window === "undefined" ||
    !storageKey ||
    !Number.isFinite(now) ||
    !isCheckoutDeliverySelection(selection)
  ) {
    return;
  }

  try {
    const existing = JSON.parse(localStorage.getItem(storageKey) ?? "null") as unknown;

    if (isPersistedPickupSelection(existing) && isSameSelection(existing, selection)) {
      if (existing.expiresAt > now && existing.expiresAt <= now + pickupSelectionTtlMs) return;

      removeStorageItem(storageKey);
      return;
    }

    const value: PersistedPickupSelection = { ...selection, expiresAt: now + pickupSelectionTtlMs };

    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Storage may be blocked by browser privacy settings.
  }
}

export function clearPersistedPickupSelection(cartId: string) {
  const storageKey = getPickupSelectionStorageKey(cartId);

  if (typeof window !== "undefined" && storageKey) removeStorageItem(storageKey);
}

function isPersistedPickupSelection(value: unknown): value is PersistedPickupSelection {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  const hasValidBase =
    isTechnicalId(candidate.pickupPointId) &&
    typeof candidate.expiresAt === "number" &&
    Number.isFinite(candidate.expiresAt);

  return (
    hasValidBase &&
    ((candidate.provider === "cdek" && isRequiredCityCode(candidate.cityCode)) ||
      (candidate.provider === "ozon" && candidate.cityCode === undefined))
  );
}

function isCheckoutDeliverySelection(
  value: CheckoutDeliverySelection,
): value is CheckoutDeliverySelection & { pickupPointId: string } {
  return (
    isTechnicalId(value.pickupPointId) &&
    (value.provider === "ozon" || (value.provider === "cdek" && isRequiredCityCode(value.cityCode)))
  );
}

function isTechnicalId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= technicalIdMaxLength;
}

function isRequiredCityCode(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= cityCodeMax;
}

function isSameSelection(
  persisted: PersistedPickupSelection,
  selection: CheckoutDeliverySelection,
) {
  return (
    persisted.provider === selection.provider &&
    persisted.pickupPointId === selection.pickupPointId &&
    (persisted.provider === "ozon" ||
      (selection.provider === "cdek" && persisted.cityCode === selection.cityCode))
  );
}

function getPickupSelectionStorageKey(cartId: string) {
  return isTechnicalId(cartId)
    ? `${pickupSelectionStorageKeyPrefix}${encodeURIComponent(cartId)}`
    : undefined;
}

function removeStorageItem(storageKey: string) {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Storage may be blocked by browser privacy settings.
  }
}
