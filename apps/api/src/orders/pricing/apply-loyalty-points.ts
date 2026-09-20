import {
  parseOrderPricingSnapshot,
  type OrderPricingSnapshot,
} from "./pricing-snapshot";

const pointKopecks = 20n;
const minimumUnitKopecks = 100n;

export function getMaxLoyaltyPoints(snapshot: OrderPricingSnapshot): number {
  const base = parseBaseSnapshot(snapshot);
  assertMinimumUnitPrice(base);
  return Number(
    base.items.reduce(
      (total, item) =>
        total +
        item.priceGroups.reduce(
          (sum, group) =>
            sum + unitCapacity(group.unitPriceKopecks) * BigInt(group.quantity),
          0n,
        ),
      0n,
    ),
  );
}

export function applyLoyaltyPoints(
  snapshot: OrderPricingSnapshot,
  points: number,
): OrderPricingSnapshot {
  if (!Number.isSafeInteger(points) || points < 0) {
    throw new RangeError("Loyalty points must be a nonnegative safe integer");
  }
  const base = parseBaseSnapshot(snapshot);
  if (points === 0) return base;
  assertMinimumUnitPrice(base);

  const allocations = base.items.flatMap((item) =>
    item.priceGroups.map((group, groupIndex) => {
      return {
        id: item.id,
        groupIndex,
        capacity: unitCapacity(group.unitPriceKopecks) * BigInt(group.quantity),
        points: 0n,
        remainder: 0n,
      };
    }),
  );
  const capacity = allocations.reduce(
    (total, group) => total + group.capacity,
    0n,
  );
  const requested = BigInt(points);
  if (requested > capacity) {
    throw new RangeError("Requested loyalty points exceed order capacity");
  }

  let allocated = 0n;
  for (const group of allocations) {
    const numerator = requested * group.capacity;
    group.points = numerator / capacity;
    group.remainder = numerator % capacity;
    allocated += group.points;
  }
  const ranked = [...allocations].sort((left, right) => {
    if (left.remainder !== right.remainder)
      return left.remainder > right.remainder ? -1 : 1;
    if (left.id !== right.id) return left.id < right.id ? -1 : 1;
    return left.groupIndex - right.groupIndex;
  });
  const remaining = requested - allocated;
  for (let index = 0; BigInt(index) < remaining; index += 1) {
    const group = ranked[index];
    if (!group || group.points >= group.capacity) {
      throw new Error("Loyalty allocation invariant failed");
    }
    group.points += 1n;
  }

  let allocationIndex = 0;
  const items = base.items.map((item) => {
    let itemPoints = 0n;
    const priceGroups = item.priceGroups.flatMap((group) => {
      const allocation = allocations[allocationIndex++];
      if (!allocation) throw new Error("Loyalty allocation invariant failed");
      itemPoints += allocation.points;
      const quantity = BigInt(group.quantity);
      const lowerPoints = allocation.points / quantity;
      const higherPointsQuantity = allocation.points % quantity;
      // Keep each original group in place, consuming higher-discount units first.
      return [
        { quantity: higherPointsQuantity, points: lowerPoints + 1n },
        { quantity: quantity - higherPointsQuantity, points: lowerPoints },
      ]
        .filter((split) => split.quantity > 0n)
        .map((split) => {
          const price =
            BigInt(group.unitPriceKopecks) - split.points * pointKopecks;
          return {
            quantity: Number(split.quantity),
            unitPriceKopecks: Number(price),
            promoDiscountPerUnitKopecks: group.promoDiscountPerUnitKopecks,
            loyaltyPointsPerUnit: Number(split.points),
            totalKopecks: Number(price * split.quantity),
          };
        });
    });
    return {
      ...item,
      loyaltyPoints: Number(itemPoints),
      loyaltyDiscountKopecks: Number(itemPoints * pointKopecks),
      totalKopecks: Number(
        BigInt(item.totalKopecks) - itemPoints * pointKopecks,
      ),
      priceGroups,
    };
  });
  const loyaltyDiscount = requested * pointKopecks;
  // Validated base totals bound every converted BigInt by MAX_SAFE_INTEGER.
  return parseOrderPricingSnapshot({
    ...base,
    loyaltyDiscountKopecks: Number(loyaltyDiscount),
    discountKopecks: Number(BigInt(base.discountKopecks) + loyaltyDiscount),
    itemsTotalKopecks: Number(BigInt(base.itemsTotalKopecks) - loyaltyDiscount),
    totalKopecks: Number(BigInt(base.totalKopecks) - loyaltyDiscount),
    items,
  });
}

function parseBaseSnapshot(
  snapshot: OrderPricingSnapshot,
): OrderPricingSnapshot {
  const base = parseOrderPricingSnapshot(snapshot);
  if (base.loyaltyDiscountKopecks !== 0) {
    throw new RangeError(
      "Loyalty points have already been applied to this snapshot",
    );
  }
  return base;
}

function unitCapacity(unitPriceKopecks: number): bigint {
  const available = BigInt(unitPriceKopecks) - minimumUnitKopecks;
  return available > 0n ? available / pointKopecks : 0n;
}

function assertMinimumUnitPrice(snapshot: OrderPricingSnapshot): void {
  if (
    snapshot.items.some((item) =>
      item.priceGroups.some(
        (group) => group.unitPriceKopecks < Number(minimumUnitKopecks),
      ),
    )
  ) {
    throw new RangeError(
      "Cannot apply loyalty points: every unit must cost at least 100 kopecks before loyalty discount",
    );
  }
}
