export type PromoPricingItemInput = Readonly<{
  id: string;
  unitPriceKopecks: number;
  quantity: number;
}>;

export type PromoDiscount =
  | Readonly<{ type: "fixed"; amountKopecks: number }>
  | Readonly<{
      type: "percentage";
      basisPoints: number;
      maxDiscountKopecks?: number;
    }>;

export type PromoPriceGroup = {
  unitPriceKopecks: number;
  quantity: number;
  totalKopecks: number;
};

export type PromoPricingItem = PromoPricingItemInput & {
  subtotalKopecks: number;
  discountKopecks: number;
  totalKopecks: number;
  priceGroups: PromoPriceGroup[];
};

export type PromoPricing = {
  subtotalKopecks: number;
  discountKopecks: number;
  totalKopecks: number;
  items: PromoPricingItem[];
};

const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);

export function calculatePromoPricing(
  items: readonly PromoPricingItemInput[],
  discount: PromoDiscount,
): PromoPricing {
  if (!Array.isArray(items)) {
    throw new TypeError("Items must be an array");
  }

  const seenIds = new Set<string>();
  const lines = items.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new TypeError(`Item at index ${index} must be an object`);
    }
    if (typeof item.id !== "string" || item.id.trim().length === 0) {
      throw new TypeError(`Item at index ${index} must have a non-empty id`);
    }
    if (seenIds.has(item.id)) {
      throw new TypeError(`Duplicate item id: ${item.id}`);
    }
    seenIds.add(item.id);

    assertNonnegativeSafeInteger(
      item.unitPriceKopecks,
      `Item ${item.id} unitPriceKopecks`,
    );
    assertPositiveSafeInteger(item.quantity, `Item ${item.id} quantity`);

    const subtotal = BigInt(item.unitPriceKopecks) * BigInt(item.quantity);
    if (subtotal > maxSafeInteger) {
      throw new RangeError(
        `Item ${item.id} subtotal exceeds safe integer range`,
      );
    }

    return { item, index, subtotal };
  });

  const discountSpec = validateDiscount(discount);
  let subtotal = 0n;
  for (const line of lines) {
    subtotal += line.subtotal;
    if (subtotal > maxSafeInteger) {
      throw new RangeError("Basket subtotal exceeds safe integer range");
    }
  }

  let discountTotal: bigint;
  if (discountSpec.type === "fixed") {
    discountTotal = BigInt(discountSpec.amountKopecks);
  } else {
    discountTotal =
      (subtotal * BigInt(discountSpec.basisPoints) + 5_000n) / 10_000n;
    if (discountSpec.maxDiscountKopecks !== undefined) {
      const cap = BigInt(discountSpec.maxDiscountKopecks);
      if (discountTotal > cap) discountTotal = cap;
    }
  }
  if (discountTotal > subtotal) discountTotal = subtotal;

  const allocatedDiscounts = lines.map(() => 0n);
  if (subtotal > 0n && discountTotal > 0n) {
    const rankedRemainders: { index: number; remainder: bigint }[] = [];
    let allocated = 0n;

    for (const line of lines) {
      if (line.subtotal === 0n) continue;

      const numerator = discountTotal * line.subtotal;
      const share = numerator / subtotal;
      allocatedDiscounts[line.index] = share;
      allocated += share;
      rankedRemainders.push({
        index: line.index,
        remainder: numerator % subtotal,
      });
    }

    rankedRemainders.sort((left, right) => {
      if (left.remainder === right.remainder) return left.index - right.index;
      return left.remainder > right.remainder ? -1 : 1;
    });

    const remaining = discountTotal - allocated;
    if (remaining >= BigInt(rankedRemainders.length + 1)) {
      throw new Error("Discount allocation invariant failed");
    }
    for (let index = 0; index < Number(remaining); index += 1) {
      const lineIndex = rankedRemainders[index]?.index;
      const currentDiscount =
        lineIndex === undefined ? undefined : allocatedDiscounts[lineIndex];
      if (lineIndex === undefined || currentDiscount === undefined) {
        throw new Error("Discount allocation invariant failed");
      }
      allocatedDiscounts[lineIndex] = currentDiscount + 1n;
    }
  }

  const pricedItems = lines.map(({ item, index, subtotal: lineSubtotal }) => {
    const lineDiscount = allocatedDiscounts[index] ?? 0n;
    const lineTotal = lineSubtotal - lineDiscount;
    const quantity = BigInt(item.quantity);
    const lowerUnitPrice = lineTotal / quantity;
    const higherUnitCount = lineTotal % quantity;
    const lowerUnitCount = quantity - higherUnitCount;
    const priceGroups: PromoPriceGroup[] = [];

    if (higherUnitCount > 0n) {
      const higherUnitPrice = lowerUnitPrice + 1n;
      priceGroups.push({
        unitPriceKopecks: Number(higherUnitPrice),
        quantity: Number(higherUnitCount),
        totalKopecks: Number(higherUnitPrice * higherUnitCount),
      });
    }
    if (lowerUnitCount > 0n) {
      priceGroups.push({
        unitPriceKopecks: Number(lowerUnitPrice),
        quantity: Number(lowerUnitCount),
        totalKopecks: Number(lowerUnitPrice * lowerUnitCount),
      });
    }

    return {
      id: item.id,
      unitPriceKopecks: item.unitPriceKopecks,
      quantity: item.quantity,
      subtotalKopecks: Number(lineSubtotal),
      discountKopecks: Number(lineDiscount),
      totalKopecks: Number(lineTotal),
      priceGroups,
    };
  });

  return {
    subtotalKopecks: Number(subtotal),
    discountKopecks: Number(discountTotal),
    totalKopecks: Number(subtotal - discountTotal),
    items: pricedItems,
  };
}

function validateDiscount(discount: PromoDiscount): PromoDiscount {
  if (typeof discount !== "object" || discount === null) {
    throw new TypeError("Discount must be an object");
  }

  if (discount.type === "fixed") {
    assertNonnegativeSafeInteger(
      discount.amountKopecks,
      "Fixed discount amountKopecks",
    );
    return discount;
  }

  if (discount.type === "percentage") {
    assertSafeInteger(discount.basisPoints, "Percentage discount basisPoints");
    if (discount.basisPoints < 1 || discount.basisPoints > 10_000) {
      throw new RangeError(
        "Percentage discount basisPoints must be between 1 and 10000",
      );
    }
    if (discount.maxDiscountKopecks !== undefined) {
      assertNonnegativeSafeInteger(
        discount.maxDiscountKopecks,
        "Percentage discount maxDiscountKopecks",
      );
    }
    return discount;
  }

  throw new TypeError("Unsupported discount type");
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
