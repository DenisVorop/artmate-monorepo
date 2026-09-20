import type { PromoPricing } from "../../promocodes/pricing";

export type OrderPricingSnapshot = {
  version: 1;
  currency: "RUB";
  subtotalKopecks: number;
  promoDiscountKopecks: number;
  loyaltyDiscountKopecks: number;
  discountKopecks: number;
  itemsTotalKopecks: number;
  deliveryKopecks: number;
  totalKopecks: number;
  items: {
    id: string;
    unitPriceKopecks: number;
    quantity: number;
    subtotalKopecks: number;
    promoDiscountKopecks: number;
    loyaltyPoints: number;
    loyaltyDiscountKopecks: number;
    totalKopecks: number;
    priceGroups: {
      quantity: number;
      unitPriceKopecks: number;
      promoDiscountPerUnitKopecks: number;
      loyaltyPointsPerUnit: number;
      totalKopecks: number;
    }[];
  }[];
};

type ExpectedOrderPricing = {
  subtotalKopecks: number;
  discountKopecks: number;
  deliveryKopecks: number;
  totalKopecks: number;
  items: {
    id: string;
    unitPriceKopecks: number;
    quantity: number;
    lineTotalKopecks: number;
  }[];
};

const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);
const loyaltyPointKopecks = 20n;

export function createOrderPricingSnapshot(
  pricing: PromoPricing,
  deliveryKopecks: number,
): OrderPricingSnapshot {
  const delivery = integer(deliveryKopecks, "deliveryKopecks");
  const itemsTotal = integer(pricing.totalKopecks, "itemsTotalKopecks");

  return parseOrderPricingSnapshot({
    version: 1,
    currency: "RUB",
    subtotalKopecks: pricing.subtotalKopecks,
    promoDiscountKopecks: pricing.discountKopecks,
    loyaltyDiscountKopecks: 0,
    discountKopecks: pricing.discountKopecks,
    itemsTotalKopecks: itemsTotal,
    deliveryKopecks: delivery,
    totalKopecks: safeNumber(
      BigInt(itemsTotal) + BigInt(delivery),
      "totalKopecks",
    ),
    items: pricing.items.map((item) => ({
      id: item.id,
      unitPriceKopecks: item.unitPriceKopecks,
      quantity: item.quantity,
      subtotalKopecks: item.subtotalKopecks,
      promoDiscountKopecks: item.discountKopecks,
      loyaltyPoints: 0,
      loyaltyDiscountKopecks: 0,
      totalKopecks: item.totalKopecks,
      // Group order determines which paid units a partial return consumes.
      priceGroups: item.priceGroups.map((group) => ({
        quantity: group.quantity,
        unitPriceKopecks: group.unitPriceKopecks,
        promoDiscountPerUnitKopecks: safeNumber(
          BigInt(integer(item.unitPriceKopecks, "item.unitPriceKopecks")) -
            BigInt(integer(group.unitPriceKopecks, "group.unitPriceKopecks")),
          "promoDiscountPerUnitKopecks",
        ),
        loyaltyPointsPerUnit: 0,
        totalKopecks: group.totalKopecks,
      })),
    })),
  });
}

export function parseOrderPricingSnapshot(
  value: unknown,
): OrderPricingSnapshot {
  const source = record(value, "snapshot", [
    "version",
    "currency",
    "subtotalKopecks",
    "promoDiscountKopecks",
    "loyaltyDiscountKopecks",
    "discountKopecks",
    "itemsTotalKopecks",
    "deliveryKopecks",
    "totalKopecks",
    "items",
  ]);
  if (source.version !== 1 || source.currency !== "RUB") {
    throw new TypeError("Unsupported pricing snapshot version or currency");
  }
  const seenIds = new Set<string>();
  const items = nonemptyArray(source.items, "items").map((value, index) => {
    const label = `items[${index}]`;
    const item = record(value, label, [
      "id",
      "unitPriceKopecks",
      "quantity",
      "subtotalKopecks",
      "promoDiscountKopecks",
      "loyaltyPoints",
      "loyaltyDiscountKopecks",
      "totalKopecks",
      "priceGroups",
    ]);
    const id = itemId(item.id, label);
    if (seenIds.has(id)) throw new TypeError(`Duplicate item id: ${id}`);
    seenIds.add(id);
    const unitPriceKopecks = integer(
      item.unitPriceKopecks,
      `${label}.unitPriceKopecks`,
    );
    const quantity = integer(item.quantity, `${label}.quantity`, true);
    const subtotalKopecks = integer(
      item.subtotalKopecks,
      `${label}.subtotalKopecks`,
    );
    const promoDiscountKopecks = integer(
      item.promoDiscountKopecks,
      `${label}.promoDiscountKopecks`,
    );
    const loyaltyPoints = integer(item.loyaltyPoints, `${label}.loyaltyPoints`);
    const loyaltyDiscountKopecks = integer(
      item.loyaltyDiscountKopecks,
      `${label}.loyaltyDiscountKopecks`,
    );
    const totalKopecks = integer(item.totalKopecks, `${label}.totalKopecks`);
    const priceGroups = nonemptyArray(
      item.priceGroups,
      `${label}.priceGroups`,
    ).map((value, index) => {
      const groupLabel = `${label}.priceGroups[${index}]`;
      const source = record(value, groupLabel, [
        "quantity",
        "unitPriceKopecks",
        "promoDiscountPerUnitKopecks",
        "loyaltyPointsPerUnit",
        "totalKopecks",
      ]);
      const group = {
        quantity: integer(source.quantity, `${groupLabel}.quantity`, true),
        unitPriceKopecks: integer(
          source.unitPriceKopecks,
          `${groupLabel}.unitPriceKopecks`,
        ),
        promoDiscountPerUnitKopecks: integer(
          source.promoDiscountPerUnitKopecks,
          `${groupLabel}.promoDiscountPerUnitKopecks`,
        ),
        loyaltyPointsPerUnit: integer(
          source.loyaltyPointsPerUnit,
          `${groupLabel}.loyaltyPointsPerUnit`,
        ),
        totalKopecks: integer(
          source.totalKopecks,
          `${groupLabel}.totalKopecks`,
        ),
      };
      equal(
        group.unitPriceKopecks,
        BigInt(unitPriceKopecks) -
          BigInt(group.promoDiscountPerUnitKopecks) -
          BigInt(group.loyaltyPointsPerUnit) * loyaltyPointKopecks,
        `${groupLabel}.unitPriceKopecks`,
      );
      equal(
        group.totalKopecks,
        BigInt(group.quantity) * BigInt(group.unitPriceKopecks),
        `${groupLabel}.totalKopecks`,
      );
      return group;
    });

    equal(
      subtotalKopecks,
      BigInt(quantity) * BigInt(unitPriceKopecks),
      `${label}.subtotalKopecks`,
    );
    equal(
      quantity,
      sum(priceGroups.map((group) => BigInt(group.quantity))),
      `${label}.quantity`,
    );
    equal(
      promoDiscountKopecks,
      sum(
        priceGroups.map(
          (group) =>
            BigInt(group.quantity) * BigInt(group.promoDiscountPerUnitKopecks),
        ),
      ),
      `${label}.promoDiscountKopecks`,
    );
    equal(
      loyaltyPoints,
      sum(
        priceGroups.map(
          (group) =>
            BigInt(group.quantity) * BigInt(group.loyaltyPointsPerUnit),
        ),
      ),
      `${label}.loyaltyPoints`,
    );
    equal(
      loyaltyDiscountKopecks,
      BigInt(loyaltyPoints) * loyaltyPointKopecks,
      `${label}.loyaltyDiscountKopecks`,
    );
    equal(
      totalKopecks,
      sum(priceGroups.map((group) => BigInt(group.totalKopecks))),
      `${label}.totalKopecks`,
    );
    equal(
      totalKopecks,
      BigInt(subtotalKopecks) -
        BigInt(promoDiscountKopecks) -
        BigInt(loyaltyDiscountKopecks),
      `${label}.totalKopecks`,
    );
    return {
      id,
      unitPriceKopecks,
      quantity,
      subtotalKopecks,
      promoDiscountKopecks,
      loyaltyPoints,
      loyaltyDiscountKopecks,
      totalKopecks,
      priceGroups,
    };
  });
  const snapshot: OrderPricingSnapshot = {
    version: 1,
    currency: "RUB",
    subtotalKopecks: integer(source.subtotalKopecks, "subtotalKopecks"),
    promoDiscountKopecks: integer(
      source.promoDiscountKopecks,
      "promoDiscountKopecks",
    ),
    loyaltyDiscountKopecks: integer(
      source.loyaltyDiscountKopecks,
      "loyaltyDiscountKopecks",
    ),
    discountKopecks: integer(source.discountKopecks, "discountKopecks"),
    itemsTotalKopecks: integer(source.itemsTotalKopecks, "itemsTotalKopecks"),
    deliveryKopecks: integer(source.deliveryKopecks, "deliveryKopecks"),
    totalKopecks: integer(source.totalKopecks, "totalKopecks"),
    items,
  };
  for (const field of [
    "subtotalKopecks",
    "promoDiscountKopecks",
    "loyaltyDiscountKopecks",
  ] as const) {
    equal(
      snapshot[field],
      sum(items.map((item) => BigInt(item[field]))),
      field,
    );
  }
  equal(
    snapshot.itemsTotalKopecks,
    sum(items.map((item) => BigInt(item.totalKopecks))),
    "itemsTotalKopecks",
  );
  equal(
    snapshot.discountKopecks,
    BigInt(snapshot.promoDiscountKopecks) +
      BigInt(snapshot.loyaltyDiscountKopecks),
    "discountKopecks",
  );
  equal(
    snapshot.itemsTotalKopecks,
    BigInt(snapshot.subtotalKopecks) - BigInt(snapshot.discountKopecks),
    "itemsTotalKopecks",
  );
  equal(
    snapshot.totalKopecks,
    BigInt(snapshot.itemsTotalKopecks) + BigInt(snapshot.deliveryKopecks),
    "totalKopecks",
  );
  return snapshot;
}

export function assertOrderPricingMatches(
  snapshot: OrderPricingSnapshot,
  expected: ExpectedOrderPricing,
): void {
  const parsed = parseOrderPricingSnapshot(snapshot);
  for (const field of [
    "subtotalKopecks",
    "discountKopecks",
    "deliveryKopecks",
    "totalKopecks",
  ] as const) {
    equal(
      parsed[field],
      BigInt(integer(expected[field], `expected.${field}`)),
      `expected.${field}`,
    );
  }
  if (
    !Array.isArray(expected.items) ||
    parsed.items.length !== expected.items.length
  ) {
    throw new TypeError("Pricing snapshot items do not match order items");
  }
  const items = new Map(parsed.items.map((item) => [item.id, item]));
  for (const expectedItem of expected.items) {
    const id = itemId(expectedItem.id, "expected item");
    const item = items.get(id);
    if (!item) throw new TypeError(`Missing or duplicate order item id: ${id}`);
    items.delete(id);
    for (const field of ["unitPriceKopecks", "quantity"] as const) {
      equal(
        item[field],
        BigInt(
          integer(
            expectedItem[field],
            `expected.${id}.${field}`,
            field === "quantity",
          ),
        ),
        `expected.${id}.${field}`,
      );
    }
    // OrderItem.lineTotalKopecks stores the original price times quantity.
    equal(
      item.subtotalKopecks,
      BigInt(
        integer(
          expectedItem.lineTotalKopecks,
          `expected.${id}.lineTotalKopecks`,
        ),
      ),
      `expected.${id}.lineTotalKopecks`,
    );
  }
}

function record(
  value: unknown,
  label: string,
  keys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  if (
    Object.keys(value).some((key) => !keys.includes(key)) ||
    keys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    throw new TypeError(`${label} has unexpected or missing fields`);
  }
  return value as Record<string, unknown>;
}

function nonemptyArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${label} must be a nonempty array`);
  }
  return Array.from(value) as unknown[];
}

function itemId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label}.id must be a nonempty string`);
  }
  return value;
}

function integer(value: unknown, label: string, positive = false): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
  if (value < 0 || (positive && value === 0)) {
    throw new RangeError(
      `${label} must be ${positive ? "positive" : "nonnegative"}`,
    );
  }
  return value;
}

function safeNumber(value: bigint, label: string): number {
  if (value < 0n || value > maxSafeInteger) {
    throw new RangeError(`${label} exceeds nonnegative safe integer range`);
  }
  return Number(value);
}

function equal(actual: number, expected: bigint, label: string): void {
  if (actual !== safeNumber(expected, label)) {
    throw new TypeError(`Pricing snapshot mismatch: ${label}`);
  }
}

function sum(values: bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}
