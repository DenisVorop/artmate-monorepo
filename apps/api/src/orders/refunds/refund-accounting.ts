export type RefundPriceGroup = Readonly<{
  unitPriceKopecks: number;
  quantity: number;
}>;

export type AffiliateCommissionStatus =
  | "pending"
  | "available"
  | "held"
  | "reversed"
  | "not_earned";

export function allocateIncrementalRefund(
  priceGroups: readonly RefundPriceGroup[],
  returnedQuantity: number,
  incrementalQuantity: number,
) {
  assertNonnegativeSafeInteger(returnedQuantity, "Returned quantity");
  assertNonnegativeSafeInteger(incrementalQuantity, "Refund quantity");

  let skipped = returnedQuantity;
  let requested = incrementalQuantity;
  let amountKopecks = 0;
  const remainingPriceGroups: RefundPriceGroup[] = [];

  for (const group of priceGroups) {
    assertNonnegativeSafeInteger(group.unitPriceKopecks, "Refund unit price");
    assertPositiveSafeInteger(group.quantity, "Refund price group quantity");

    const afterPreviouslyReturned = Math.max(0, group.quantity - skipped);
    skipped = Math.max(0, skipped - group.quantity);
    const refundedFromGroup = Math.min(afterPreviouslyReturned, requested);
    requested -= refundedFromGroup;
    amountKopecks += refundedFromGroup * group.unitPriceKopecks;
    const remaining = afterPreviouslyReturned - refundedFromGroup;
    if (remaining > 0) {
      remainingPriceGroups.push({
        unitPriceKopecks: group.unitPriceKopecks,
        quantity: remaining,
      });
    }
  }

  if (skipped > 0 || requested > 0 || !Number.isSafeInteger(amountKopecks)) {
    throw new RangeError("Refund quantity exceeds purchased quantity");
  }

  return { amountKopecks, remainingPriceGroups };
}

export function getAffiliateCommissionStatus(input: {
  availableAt: Date | null;
  completedAt: Date | null;
  earnedKopecks: number;
  isCancelled: boolean;
  isCompleted: boolean;
  isPaid: boolean;
  now: Date;
  reversedKopecks: number;
}): AffiliateCommissionStatus {
  if (input.earnedKopecks === 0) return "not_earned";
  if (input.reversedKopecks >= input.earnedKopecks) return "reversed";
  if (
    (!input.isPaid || !input.isCompleted) &&
    (input.completedAt !== null || input.isCancelled)
  ) {
    return "held";
  }
  if (
    !input.completedAt ||
    !input.availableAt ||
    input.now < input.availableAt
  ) {
    return "pending";
  }
  return input.isPaid && input.isCompleted ? "available" : "pending";
}

function assertNonnegativeSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a nonnegative safe integer`);
  }
}

function assertPositiveSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}
