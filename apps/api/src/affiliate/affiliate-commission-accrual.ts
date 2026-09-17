import {
  calculateAffiliateCommission,
  getAffiliateCommissionAvailableAt,
} from "./commission";

export type AffiliateOrderSnapshot = Readonly<{
  checkoutActorUserId: string | null;
  completedAt: Date | null;
  items: readonly Readonly<{
    id: string;
    quantity: number;
    unitPriceKopecks: number;
  }>[];
  promoCode: string | null;
  promoPricingSnapshot: unknown;
  promoTermsSnapshot: unknown;
  subtotalKopecks: number;
  userId: string | null;
}>;

export type AffiliateCommissionAccrual = Readonly<{
  availableAt: Date | null;
  buyerPercent: number;
  codeSnapshot: string;
  earnedKopecks: number;
  isSelfPurchase: boolean;
  itemSnapshot: ReturnType<typeof calculateAffiliateCommission>["items"];
  partnerId: string;
  partnerPercent: number;
  subtotalKopecks: number;
}>;

export function buildAffiliateCommissionAccrual(
  order: AffiliateOrderSnapshot,
): AffiliateCommissionAccrual | undefined {
  if (!order.promoCode) return undefined;
  const terms = asObject(order.promoTermsSnapshot);
  if (!terms || typeof terms.kind !== "string") {
    throw new TypeError("Promo terms snapshot is invalid");
  }
  if (terms.kind !== "affiliate") {
    if (terms.kind === "standard" || terms.kind === "welcome") return undefined;
    throw new TypeError("Promo kind snapshot is invalid");
  }

  const affiliate = asObject(terms.affiliate);
  const partnerId = requiredString(
    affiliate?.partnerId,
    "Affiliate partner id",
  );
  const partnerUserId = requiredString(
    affiliate?.partnerUserId,
    "Affiliate partner user id",
  );
  const partnerPercent = requiredInteger(
    affiliate?.partnerPercent,
    "Affiliate partner percent",
  );
  const buyerPercent = requiredInteger(
    affiliate?.buyerPercent,
    "Affiliate buyer percent",
  );
  if (buyerPercent !== 20 - partnerPercent) {
    throw new RangeError("Affiliate percentages do not match the saved budget");
  }
  if (typeof affiliate?.isSelfPurchase !== "boolean") {
    throw new TypeError("Affiliate self-purchase snapshot is invalid");
  }

  const pricing = asObject(order.promoPricingSnapshot);
  if (!pricing || !Array.isArray(pricing.items)) {
    throw new TypeError("Affiliate pricing snapshot is invalid");
  }
  if (
    pricing.items.length === 0 ||
    order.items.length !== pricing.items.length
  ) {
    throw new TypeError("Affiliate pricing items do not match the order");
  }
  const persistedItems = new Map(order.items.map((item) => [item.id, item]));
  if (persistedItems.size !== order.items.length) {
    throw new TypeError("Persisted affiliate order items are invalid");
  }
  let savedSubtotalKopecks = 0;
  let savedDiscountKopecks = 0;
  let savedTotalKopecks = 0;
  const items = pricing.items.map((value, index) => {
    const item = asObject(value);
    const parsed = {
      id: requiredString(item?.id, `Affiliate pricing item ${index} id`),
      unitPriceKopecks: requiredInteger(
        item?.unitPriceKopecks,
        `Affiliate pricing item ${index} price`,
      ),
      quantity: requiredInteger(
        item?.quantity,
        `Affiliate pricing item ${index} quantity`,
      ),
    };
    const lineSubtotal = requiredInteger(
      item?.subtotalKopecks,
      `Affiliate pricing item ${index} subtotal`,
    );
    const lineDiscount = requiredInteger(
      item?.discountKopecks,
      `Affiliate pricing item ${index} discount`,
    );
    const lineTotal = requiredInteger(
      item?.totalKopecks,
      `Affiliate pricing item ${index} total`,
    );
    const persisted = persistedItems.get(parsed.id);
    if (
      !persisted ||
      lineDiscount < 0 ||
      lineTotal < 0 ||
      persisted.quantity !== parsed.quantity ||
      persisted.unitPriceKopecks !== parsed.unitPriceKopecks ||
      !Number.isSafeInteger(parsed.unitPriceKopecks * parsed.quantity) ||
      parsed.unitPriceKopecks * parsed.quantity !== lineSubtotal ||
      lineSubtotal - lineDiscount !== lineTotal
    ) {
      throw new RangeError("Affiliate pricing item subtotal is inconsistent");
    }
    savedSubtotalKopecks += lineSubtotal;
    savedDiscountKopecks += lineDiscount;
    savedTotalKopecks += lineTotal;
    if (
      !Number.isSafeInteger(savedSubtotalKopecks) ||
      !Number.isSafeInteger(savedDiscountKopecks) ||
      !Number.isSafeInteger(savedTotalKopecks)
    ) {
      throw new RangeError(
        "Affiliate pricing subtotal exceeds safe integer range",
      );
    }
    return parsed;
  });
  if (
    requiredInteger(pricing.subtotalKopecks, "Affiliate pricing subtotal") !==
      savedSubtotalKopecks ||
    requiredInteger(pricing.discountKopecks, "Affiliate pricing discount") !==
      savedDiscountKopecks ||
    requiredInteger(pricing.totalKopecks, "Affiliate pricing total") !==
      savedTotalKopecks ||
    savedSubtotalKopecks - savedDiscountKopecks !== savedTotalKopecks ||
    order.subtotalKopecks !== savedSubtotalKopecks
  ) {
    throw new RangeError("Affiliate pricing subtotal is inconsistent");
  }
  const isSelfPurchase =
    affiliate.isSelfPurchase ||
    order.userId === partnerUserId ||
    order.checkoutActorUserId === partnerUserId;
  const commission = calculateAffiliateCommission(
    items,
    partnerPercent,
    isSelfPurchase,
  );

  return {
    availableAt: order.completedAt
      ? getAffiliateCommissionAvailableAt(order.completedAt)
      : null,
    buyerPercent,
    codeSnapshot: order.promoCode,
    earnedKopecks: commission.commissionKopecks,
    isSelfPurchase,
    itemSnapshot: commission.items,
    partnerId,
    partnerPercent,
    subtotalKopecks: commission.subtotalKopecks,
  };
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function requiredInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} is invalid`);
  return value as number;
}
