import {
  calculatePromoPricing,
  type PromoPricingItemInput,
} from "../promocodes/pricing";

export type AffiliateCommissionItem = Readonly<{
  id: string;
  quantity: number;
  subtotalKopecks: number;
  commissionKopecks: number;
}>;

export type AffiliateCommissionSnapshot = Readonly<{
  subtotalKopecks: number;
  commissionKopecks: number;
  items: readonly AffiliateCommissionItem[];
}>;

export type AffiliateReturnedQuantity = Readonly<{
  id: string;
  quantity: number;
}>;

export type AffiliateCommissionReversal = Readonly<{
  reversedCommissionKopecks: number;
  remainingCommissionKopecks: number;
}>;

const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);
const confirmationPeriodMilliseconds = 14 * 24 * 60 * 60 * 1_000;

export function calculateAffiliateCommission(
  items: readonly PromoPricingItemInput[],
  partnerPercent: number,
  isSelfPurchase = false,
): AffiliateCommissionSnapshot {
  assertSafeInteger(partnerPercent, "Partner percent");
  if (partnerPercent < 0 || partnerPercent > 15) {
    throw new RangeError("Partner percent must be between 0 and 15");
  }

  const pricing = calculatePromoPricing(
    items,
    partnerPercent === 0 || isSelfPurchase
      ? { type: "fixed", amountKopecks: 0 }
      : { type: "percentage", basisPoints: partnerPercent * 100 },
  );

  return {
    subtotalKopecks: pricing.subtotalKopecks,
    commissionKopecks: pricing.discountKopecks,
    items: pricing.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      subtotalKopecks: item.subtotalKopecks,
      commissionKopecks: item.discountKopecks,
    })),
  };
}

export function calculateAffiliateCommissionReversal(
  snapshot: AffiliateCommissionSnapshot,
  previousReturnedQuantities: readonly AffiliateReturnedQuantity[],
  nextReturnedQuantities: readonly AffiliateReturnedQuantity[],
): AffiliateCommissionReversal {
  const quantitiesById = validateSnapshot(snapshot);
  const previous = validateReturnedQuantities(
    previousReturnedQuantities,
    quantitiesById,
    "Previous returned quantities",
  );
  const next = validateReturnedQuantities(
    nextReturnedQuantities,
    quantitiesById,
    "Next returned quantities",
  );

  let previouslyReversed = 0n;
  let nextReversed = 0n;

  for (const item of snapshot.items) {
    const previousQuantity = previous.get(item.id) ?? 0;
    const nextQuantity = next.get(item.id) ?? 0;
    if (nextQuantity < previousQuantity) {
      throw new RangeError(
        `Returned quantity for item ${item.id} cannot decrease`,
      );
    }

    previouslyReversed += calculateReturnedCommission(item, previousQuantity);
    nextReversed += calculateReturnedCommission(item, nextQuantity);
  }

  return {
    reversedCommissionKopecks: Number(nextReversed - previouslyReversed),
    remainingCommissionKopecks: Number(
      BigInt(snapshot.commissionKopecks) - nextReversed,
    ),
  };
}

export function getAffiliateCommissionAvailableAt(completedAt: Date): Date {
  if (
    !(completedAt instanceof Date) ||
    !Number.isFinite(completedAt.getTime())
  ) {
    throw new TypeError("Completed date must be valid");
  }

  const availableAt = new Date(
    completedAt.getTime() + confirmationPeriodMilliseconds,
  );
  if (!Number.isFinite(availableAt.getTime())) {
    throw new RangeError("Affiliate commission availability date overflow");
  }
  return availableAt;
}

function validateSnapshot(
  snapshot: AffiliateCommissionSnapshot,
): ReadonlyMap<string, number> {
  if (typeof snapshot !== "object" || snapshot === null) {
    throw new TypeError("Commission snapshot must be an object");
  }
  assertNonnegativeSafeInteger(
    snapshot.subtotalKopecks,
    "Snapshot subtotalKopecks",
  );
  assertNonnegativeSafeInteger(
    snapshot.commissionKopecks,
    "Snapshot commissionKopecks",
  );
  if (!Array.isArray(snapshot.items)) {
    throw new TypeError("Snapshot items must be an array");
  }

  const quantitiesById = new Map<string, number>();
  let subtotal = 0n;
  let commission = 0n;

  snapshot.items.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new TypeError(`Snapshot item at index ${index} must be an object`);
    }
    if (typeof item.id !== "string" || item.id.trim().length === 0) {
      throw new TypeError(
        `Snapshot item at index ${index} must have a non-empty id`,
      );
    }
    if (quantitiesById.has(item.id)) {
      throw new TypeError(`Duplicate snapshot item id: ${item.id}`);
    }
    assertPositiveSafeInteger(
      item.quantity,
      `Snapshot item ${item.id} quantity`,
    );
    assertNonnegativeSafeInteger(
      item.subtotalKopecks,
      `Snapshot item ${item.id} subtotalKopecks`,
    );
    assertNonnegativeSafeInteger(
      item.commissionKopecks,
      `Snapshot item ${item.id} commissionKopecks`,
    );
    if (item.commissionKopecks > item.subtotalKopecks) {
      throw new RangeError(
        `Snapshot item ${item.id} commission exceeds subtotal`,
      );
    }

    quantitiesById.set(item.id, item.quantity);
    subtotal += BigInt(item.subtotalKopecks);
    commission += BigInt(item.commissionKopecks);
    if (subtotal > maxSafeInteger || commission > maxSafeInteger) {
      throw new RangeError("Snapshot totals exceed safe integer range");
    }
  });

  if (subtotal !== BigInt(snapshot.subtotalKopecks)) {
    throw new RangeError("Snapshot subtotal does not match item subtotals");
  }
  if (commission !== BigInt(snapshot.commissionKopecks)) {
    throw new RangeError("Snapshot commission does not match item commissions");
  }
  if (commission > subtotal) {
    throw new RangeError("Snapshot commission exceeds subtotal");
  }

  return quantitiesById;
}

function validateReturnedQuantities(
  returnedQuantities: readonly AffiliateReturnedQuantity[],
  quantitiesById: ReadonlyMap<string, number>,
  label: string,
): ReadonlyMap<string, number> {
  if (!Array.isArray(returnedQuantities)) {
    throw new TypeError(`${label} must be an array`);
  }

  const result = new Map<string, number>();
  returnedQuantities.forEach((returned, index) => {
    if (typeof returned !== "object" || returned === null) {
      throw new TypeError(`${label} item at index ${index} must be an object`);
    }
    if (typeof returned.id !== "string" || returned.id.trim().length === 0) {
      throw new TypeError(`${label} item at index ${index} has an invalid id`);
    }
    const boughtQuantity = quantitiesById.get(returned.id);
    if (boughtQuantity === undefined) {
      throw new RangeError(`${label} contains unknown item id: ${returned.id}`);
    }
    if (result.has(returned.id)) {
      throw new TypeError(
        `${label} contains duplicate item id: ${returned.id}`,
      );
    }
    assertNonnegativeSafeInteger(
      returned.quantity,
      `${label} item ${returned.id} quantity`,
    );
    if (returned.quantity > boughtQuantity) {
      throw new RangeError(
        `${label} item ${returned.id} quantity exceeds purchased quantity`,
      );
    }
    result.set(returned.id, returned.quantity);
  });
  return result;
}

function calculateReturnedCommission(
  item: AffiliateCommissionItem,
  returnedQuantity: number,
): bigint {
  const quantity = BigInt(item.quantity);
  const commission = BigInt(item.commissionKopecks);
  const returned = BigInt(returnedQuantity);
  const commissionPerUnit = commission / quantity;
  const unitsWithExtraKopeck = commission % quantity;

  return (
    commissionPerUnit * returned +
    (returned < unitsWithExtraKopeck ? returned : unitsWithExtraKopeck)
  );
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
}

function assertNonnegativeSafeInteger(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value < 0) throw new RangeError(`${label} must be nonnegative`);
}

function assertPositiveSafeInteger(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive`);
}
