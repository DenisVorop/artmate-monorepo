import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAffiliateCommissionAccrual } from "../src/affiliate/affiliate-commission-accrual";

const affiliateTerms = {
  kind: "affiliate",
  affiliate: {
    partnerId: "partner-1",
    partnerUserId: "partner-user",
    partnerPercent: 15,
    buyerPercent: 5,
    isSelfPurchase: false,
  },
};
const pricing = {
  subtotalKopecks: 10,
  discountKopecks: 1,
  totalKopecks: 9,
  items: [
    {
      id: "first",
      unitPriceKopecks: 3,
      quantity: 1,
      subtotalKopecks: 3,
      discountKopecks: 0,
      totalKopecks: 3,
      priceGroups: [{ unitPriceKopecks: 3, quantity: 1, totalKopecks: 3 }],
    },
    {
      id: "second",
      unitPriceKopecks: 7,
      quantity: 1,
      subtotalKopecks: 7,
      discountKopecks: 1,
      totalKopecks: 6,
      priceGroups: [{ unitPriceKopecks: 6, quantity: 1, totalKopecks: 6 }],
    },
  ],
};
const persistedOrder = {
  subtotalKopecks: 10,
  items: [
    { id: "first", unitPriceKopecks: 3, quantity: 1 },
    { id: "second", unitPriceKopecks: 7, quantity: 1 },
  ],
};

describe("buildAffiliateCommissionAccrual", () => {
  it("uses immutable terms and original merchandise prices", () => {
    assert.deepEqual(
      buildAffiliateCommissionAccrual({
        ...persistedOrder,
        checkoutActorUserId: "buyer",
        completedAt: null,
        promoCode: "ARTM-SAVED",
        promoPricingSnapshot: pricing,
        promoTermsSnapshot: affiliateTerms,
        userId: "buyer",
      }),
      {
        availableAt: null,
        buyerPercent: 5,
        codeSnapshot: "ARTM-SAVED",
        earnedKopecks: 2,
        isSelfPurchase: false,
        itemSnapshot: [
          {
            id: "first",
            quantity: 1,
            subtotalKopecks: 3,
            commissionKopecks: 1,
          },
          {
            id: "second",
            quantity: 1,
            subtotalKopecks: 7,
            commissionKopecks: 1,
          },
        ],
        partnerId: "partner-1",
        partnerPercent: 15,
        subtotalKopecks: 10,
      },
    );
  });

  it("suppresses a stale non-self snapshot when persisted buyer identity is the partner", () => {
    const result = buildAffiliateCommissionAccrual({
      ...persistedOrder,
      checkoutActorUserId: null,
      completedAt: new Date("2026-09-01T00:00:00.000Z"),
      promoCode: "ARTM-SELF",
      promoPricingSnapshot: pricing,
      promoTermsSnapshot: affiliateTerms,
      userId: "partner-user",
    });

    assert.equal(result?.isSelfPurchase, true);
    assert.equal(result?.earnedKopecks, 0);
    assert.equal(
      result?.availableAt?.toISOString(),
      "2026-09-15T00:00:00.000Z",
    );
  });

  it("records zero percent and rejects malformed affiliate snapshots", () => {
    const zero = buildAffiliateCommissionAccrual({
      ...persistedOrder,
      checkoutActorUserId: "buyer",
      completedAt: null,
      promoCode: "ARTM-ZERO",
      promoPricingSnapshot: pricing,
      promoTermsSnapshot: {
        ...affiliateTerms,
        affiliate: {
          ...affiliateTerms.affiliate,
          partnerPercent: 0,
          buyerPercent: 20,
        },
      },
      userId: "buyer",
    });
    assert.equal(zero?.earnedKopecks, 0);

    assert.throws(() =>
      buildAffiliateCommissionAccrual({
        ...persistedOrder,
        checkoutActorUserId: "buyer",
        completedAt: null,
        promoCode: "ARTM-BAD",
        promoPricingSnapshot: pricing,
        promoTermsSnapshot: {
          kind: "affiliate",
          affiliate: { partnerId: "partner-1" },
        },
        userId: "buyer",
      }),
    );
    assert.throws(() =>
      buildAffiliateCommissionAccrual({
        ...persistedOrder,
        checkoutActorUserId: "buyer",
        completedAt: null,
        promoCode: "ARTM-BAD-TOTAL",
        promoPricingSnapshot: {
          ...pricing,
          totalKopecks: 8,
        },
        promoTermsSnapshot: affiliateTerms,
        userId: "buyer",
      }),
    );
    assert.throws(() =>
      buildAffiliateCommissionAccrual({
        ...persistedOrder,
        checkoutActorUserId: "buyer",
        completedAt: null,
        promoCode: "ARTM-BAD-PRICE",
        promoPricingSnapshot: {
          ...pricing,
          subtotalKopecks: 11,
        },
        promoTermsSnapshot: affiliateTerms,
        userId: "buyer",
      }),
    );
    assert.throws(() =>
      buildAffiliateCommissionAccrual({
        ...persistedOrder,
        checkoutActorUserId: "buyer",
        completedAt: null,
        promoCode: "ARTM-UNKNOWN",
        promoPricingSnapshot: pricing,
        promoTermsSnapshot: null,
        userId: "buyer",
      }),
    );
    assert.throws(() =>
      buildAffiliateCommissionAccrual({
        ...persistedOrder,
        items: [{ id: "first", unitPriceKopecks: 3, quantity: 1 }],
        checkoutActorUserId: "buyer",
        completedAt: null,
        promoCode: "ARTM-MISSING-ITEM",
        promoPricingSnapshot: pricing,
        promoTermsSnapshot: affiliateTerms,
        userId: "buyer",
      }),
    );
    assert.throws(() =>
      buildAffiliateCommissionAccrual({
        ...persistedOrder,
        items: persistedOrder.items.map((item) =>
          item.id === "second" ? { ...item, unitPriceKopecks: 8 } : item,
        ),
        checkoutActorUserId: "buyer",
        completedAt: null,
        promoCode: "ARTM-WRONG-PRICE",
        promoPricingSnapshot: pricing,
        promoTermsSnapshot: affiliateTerms,
        userId: "buyer",
      }),
    );
  });

  it("ignores non-affiliate orders without estimating values", () => {
    assert.equal(
      buildAffiliateCommissionAccrual({
        ...persistedOrder,
        checkoutActorUserId: "buyer",
        completedAt: null,
        promoCode: "SALE",
        promoPricingSnapshot: pricing,
        promoTermsSnapshot: { kind: "standard" },
        userId: "buyer",
      }),
      undefined,
    );
  });
});
