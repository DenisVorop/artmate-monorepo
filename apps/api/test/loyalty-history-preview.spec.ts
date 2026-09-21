import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NotFoundException } from "@nestjs/common";

import { Prisma } from "../src/generated/prisma/client";
import {
  previewPurchaseHistory,
  type HistoricalPurchase,
} from "../src/loyalty/history-preview";
import { LoyaltyHistoryPreviewService } from "../src/loyalty/history-preview.service";
import { purchaseRulesVersion } from "../src/loyalty/purchase-rules";
import { createOrderPricingSnapshot } from "../src/orders/pricing/pricing-snapshot";
import type { PrismaService } from "../src/prisma/prisma.service";
import { calculatePromoPricing } from "../src/promocodes/pricing";

const at = (day: number, hour = 0) =>
  new Date(Date.UTC(2026, 0, day, hour));

function purchase(
  id: string,
  createdDay: number,
  cashKopecks: bigint,
  overrides: Partial<HistoricalPurchase> = {},
): HistoricalPurchase {
  return {
    id,
    createdAt: at(createdDay),
    paidAt: at(createdDay, 1),
    completedAt: at(createdDay, 2),
    paid: true,
    status: "completed",
    cashKopecks,
    spentPoints: false,
    ratePercent: null,
    rateVersion: null,
    refunds: [],
    transitions: [],
    accounted: false,
    ...overrides,
  };
}

describe("previewPurchaseHistory", () => {
  it("reconstructs the 3/5/7/10 rates from strictly earlier paid and completed purchases", () => {
    const result = previewPurchaseHistory([
      purchase("first", 1, 300_000n),
      purchase("second", 2, 400_000n),
      purchase("third", 3, 500_000n),
      purchase("fourth", 4, 10_000n),
    ]);

    assert.equal(result.complete, true);
    assert.equal(result.proposedCreditPoints, 3_250);
    assert.deepEqual(
      result.entries.map((entry) => ({
        id: entry.orderId,
        rate: entry.ratePercent,
        spend: entry.spendBeforeCheckoutKopecks,
        points: entry.netRewardPoints,
      })),
      [
        { id: "first", rate: 3, spend: "0", points: 450 },
        { id: "second", rate: 5, spend: "300000", points: 1_000 },
        { id: "third", rate: 7, spend: "700000", points: 1_750 },
        { id: "fourth", rate: 10, spend: "1200000", points: 50 },
      ],
    );
  });

  it("accepts completion before payment but excludes either fact at or after checkout", () => {
    const result = previewPurchaseHistory([
      purchase("completed-before-paid", 1, 300_000n, {
        completedAt: at(2),
        paidAt: at(3),
      }),
      purchase("paid-at-checkout", 1, 300_000n, {
        paidAt: at(4),
        completedAt: at(3),
      }),
      purchase("completed-after-checkout", 1, 300_000n, {
        paidAt: at(2),
        completedAt: at(5),
      }),
      purchase("checkout", 4, 10_000n),
    ]);

    const checkout = result.entries.find(
      (entry) => entry.orderId === "checkout",
    );
    assert.deepEqual(checkout, {
      orderId: "checkout",
      ratePercent: 5,
      rateSource: "historical",
      spendBeforeCheckoutKopecks: "300000",
      netRewardPoints: 25,
      proposedCreditPoints: 25,
      accounted: false,
    });
  });

  it("applies pre-checkout refunds to the tier but not later refunds", () => {
    const result = previewPurchaseHistory([
      purchase("before", 1, 400_000n, {
        refunds: [{ at: at(3), cashKopecks: 150_000n }],
      }),
      purchase("after", 1, 400_000n, {
        refunds: [{ at: at(5), cashKopecks: 150_000n }],
      }),
      purchase("checkout", 4, 10_000n),
    ]);

    const checkout = result.entries.find(
      (entry) => entry.orderId === "checkout",
    );
    assert.equal(checkout?.spendBeforeCheckoutKopecks, "650000");
    assert.equal(checkout?.ratePercent, 5);
  });

  it("preserves a valid checkout rate instead of retroactively recalculating it", () => {
    const result = previewPurchaseHistory([
      purchase("frozen", 1, 100_000n, {
        ratePercent: 10,
        rateVersion: purchaseRulesVersion,
        refunds: [{ at: at(3), cashKopecks: 20_000n }],
      }),
    ]);

    assert.deepEqual(result.entries[0], {
      orderId: "frozen",
      ratePercent: 10,
      rateSource: "checkout",
      spendBeforeCheckoutKopecks: "0",
      netRewardPoints: 400,
      proposedCreditPoints: 400,
      accounted: false,
    });
  });

  it("uses current net goods cash for rewards and grants none when points were spent", () => {
    const result = previewPurchaseHistory([
      purchase("cash-only", 1, 100_000n, {
        refunds: [{ at: at(3), cashKopecks: 20_000n }],
      }),
      purchase("spent", 4, 100_000n, { spentPoints: true }),
    ]);

    assert.equal(result.entries[0]?.netRewardPoints, 120);
    assert.equal(result.entries[1]?.netRewardPoints, 0);
    assert.equal(result.proposedCreditPoints, 120);
  });

  it("accepts a refund after payment but before first completion", () => {
    const result = previewPurchaseHistory([
      purchase("early-refund", 1, 100_000n, {
        completedAt: at(3),
        refunds: [{ at: at(2), cashKopecks: 20_000n }],
      }),
    ]);

    assert.equal(result.complete, true);
    assert.equal(result.entries[0]?.netRewardPoints, 120);
    assert.equal(result.proposedCreditPoints, 120);
  });

  it("follows cancellation and reopening chronology at each later checkout", () => {
    const prior = purchase("prior", 1, 300_000n, {
      completedAt: at(2),
      status: "completed",
      transitions: [
        { at: at(3), from: "completed", to: "cancelled" },
        { at: at(5), from: "cancelled", to: "completed" },
      ],
    });
    const result = previewPurchaseHistory([
      prior,
      purchase("while-cancelled", 4, 0n),
      purchase("after-reopen", 6, 0n),
    ]);

    assert.equal(result.complete, true);
    assert.equal(result.entries[1]?.spendBeforeCheckoutKopecks, "0");
    assert.equal(result.entries[1]?.ratePercent, 3);
    assert.equal(result.entries[2]?.spendBeforeCheckoutKopecks, "300000");
    assert.equal(result.entries[2]?.ratePercent, 5);
  });

  it("makes inconsistent facts incomplete and never publishes a payable total", () => {
    const invalidDate = purchase("invalid-date", 1, 100n, {
      paidAt: new Date(Number.NaN),
    });
    const invalidStatus = purchase("invalid-status", 2, 100n, {
      status: "refunded",
    });
    const duplicateA = purchase("duplicate", 3, 100n);
    const duplicateB = purchase("duplicate", 4, 100n);
    const brokenHistory = purchase("history", 5, 100n, {
      status: "cancelled",
      transitions: [
        { at: at(6), from: "completed", to: "cancelled" },
        { at: at(6), from: "cancelled", to: "completed" },
      ],
    });

    const result = previewPurchaseHistory([
      invalidDate,
      invalidStatus,
      duplicateA,
      duplicateB,
      brokenHistory,
    ]);

    assert.equal(result.complete, false);
    assert.equal(result.proposedCreditPoints, null);
    assert.deepEqual(
      new Set(result.issues.map((issue) => issue.reason)),
      new Set(["invalid_order_facts", "incomplete_status_history"]),
    );
    assert.ok(result.issues.some((issue) => issue.orderId === "duplicate"));
  });

  it("does not mutate input history while sorting orders and transitions", () => {
    const orders = [
      purchase("later", 3, 100n),
      purchase("earlier", 1, 100n, {
        status: "completed",
        transitions: [
          { at: at(2, 2), from: "cancelled", to: "completed" },
          { at: at(2, 1), from: "completed", to: "cancelled" },
        ],
      }),
    ];
    const before = structuredClone(orders);

    previewPurchaseHistory(orders);

    assert.deepEqual(orders, before);
  });

  it("does not propose a second credit for an already-accounted purchase", () => {
    const result = previewPurchaseHistory([
      purchase("existing-account", 1, 100_000n, { accounted: true }),
    ]);

    assert.equal(result.entries[0]?.netRewardPoints, 150);
    assert.equal(result.entries[0]?.proposedCreditPoints, 0);
    assert.equal(result.proposedCreditPoints, 0);
  });
});

function canonicalOrder() {
  const pricingSnapshot = createOrderPricingSnapshot(
    calculatePromoPricing(
      [{ id: "product", unitPriceKopecks: 100_000, quantity: 1 }],
      { type: "fixed", amountKopecks: 0 },
    ),
    10_000,
  );
  return {
    id: "order-1",
    userId: "user-1",
    recipientEmail: "guest@example.test",
    createdAt: at(1),
    paidAt: at(1, 1),
    completedAt: at(1, 2),
    paymentStatus: "PAID",
    crmStatus: "COMPLETED",
    currency: "RUB",
    subtotal: "1000",
    discount: "0",
    deliveryPrice: "100",
    total: "1100",
    pricingSnapshot,
    loyaltyRatePercent: null,
    loyaltyRateVersion: null,
    items: [
      {
        productId: "product",
        price: "1000",
        quantity: 1,
        lineTotal: "1000",
      },
    ],
    refunds: [
      {
        createdAt: at(3),
        totalKopecks: 30_000n,
        deliveryKopecks: 10_000n,
        event: { occurredAt: at(3) },
      },
    ],
    history: [],
    purchaseAccount: null,
  };
}

function serviceFixture(overrides: {
  member?: unknown;
  orders?: unknown[];
  operations?: unknown[];
} = {}) {
  const calls: Array<{ model: string; args: unknown }> = [];
  let transactionOptions: unknown;
  let writes = 0;
  const readModel = (model: string, result: unknown, method: string) => ({
    [method]: async (args: unknown) => {
      calls.push({ model, args });
      return result;
    },
    create: async () => {
      writes += 1;
    },
    update: async () => {
      writes += 1;
    },
    upsert: async () => {
      writes += 1;
    },
  });
  const tx = {
    loyaltyMember: readModel(
      "loyaltyMember",
      overrides.member === undefined
        ? { id: "member-1", userId: "user-1" }
        : overrides.member,
      "findUnique",
    ),
    order: readModel(
      "order",
      overrides.orders ?? [canonicalOrder()],
      "findMany",
    ),
    loyaltyOperation: readModel(
      "loyaltyOperation",
      overrides.operations ?? [],
      "findMany",
    ),
  };
  const prisma = {
    $transaction: async <T>(
      callback: (client: typeof tx) => Promise<T>,
      options: unknown,
    ) => {
      transactionOptions = options;
      return callback(tx);
    },
  } as unknown as PrismaService;
  return {
    service: new LoyaltyHistoryPreviewService(prisma),
    calls,
    get transactionOptions() {
      return transactionOptions;
    },
    get writes() {
      return writes;
    },
  };
}

describe("LoyaltyHistoryPreviewService", () => {
  it("reads only the member's userId scope in RepeatableRead and canonical sources", async () => {
    const fixture = serviceFixture();

    const result = await fixture.service.previewMember("member-1");

    assert.deepEqual(fixture.transactionOptions, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    assert.deepEqual(fixture.calls[0], {
      model: "loyaltyMember",
      args: { where: { id: "member-1" } },
    });
    const orderRead = fixture.calls.find((call) => call.model === "order");
    assert.deepEqual(
      (orderRead?.args as { where: unknown }).where,
      { userId: "user-1" },
    );
    assert.doesNotMatch(JSON.stringify(orderRead?.args), /recipientEmail|email/i);
    assert.equal(result.complete, true);
    assert.equal(result.entries[0]?.netRewardPoints, 120);
    assert.equal(result.proposedCreditPoints, 120);
    assert.equal(fixture.writes, 0);
  });

  it("skips truly unfinished orders without trying to parse their missing pricing", async () => {
    const unfinished = {
      ...canonicalOrder(),
      id: "unfinished",
      paymentStatus: "PENDING",
      paidAt: null,
      completedAt: null,
      crmStatus: "NEW",
      pricingSnapshot: null,
      refunds: [],
    };
    const fixture = serviceFixture({ orders: [unfinished] });

    const result = await fixture.service.previewMember("member-1");

    assert.equal(result.complete, true);
    assert.deepEqual(result.entries, []);
    assert.equal(result.proposedCreditPoints, 0);
  });

  it("reports malformed canonical data and unlinked purchase operations as incomplete", async () => {
    const malformed = { ...canonicalOrder(), pricingSnapshot: null };
    const fixture = serviceFixture({
      orders: [malformed],
      operations: [
        {
          sourceKey: "purchase:legacy-order",
          purchaseOrderId: null,
        },
      ],
    });

    const result = await fixture.service.previewMember("member-1");

    assert.equal(result.complete, false);
    assert.equal(result.proposedCreditPoints, null);
    assert.deepEqual(result.issues, [
      {
        orderId: "purchase:legacy-order",
        reason: "unlinked_existing_purchase_operation",
      },
      { orderId: "order-1", reason: "invalid_purchase_source" },
    ]);
  });

  it("does not silently skip a completed order whose completion fact is missing", async () => {
    const malformed = {
      ...canonicalOrder(),
      paymentStatus: "PENDING",
      paidAt: null,
      completedAt: null,
      crmStatus: "COMPLETED",
      pricingSnapshot: null,
      refunds: [],
    };
    const fixture = serviceFixture({ orders: [malformed] });

    const result = await fixture.service.previewMember("member-1");

    assert.equal(result.complete, false);
    assert.equal(result.proposedCreditPoints, null);
    assert.deepEqual(result.issues, [
      { orderId: "order-1", reason: "invalid_purchase_source" },
    ]);
  });

  it("recognizes an existing purchase account without proposing a duplicate grant", async () => {
    const order = {
      ...canonicalOrder(),
      refunds: [],
      purchaseAccount: { memberId: "member-1" },
    };
    const fixture = serviceFixture({ orders: [order] });

    const result = await fixture.service.previewMember("member-1");

    assert.equal(result.complete, true);
    assert.equal(result.entries[0]?.netRewardPoints, 150);
    assert.equal(result.entries[0]?.accounted, true);
    assert.equal(result.entries[0]?.proposedCreditPoints, 0);
    assert.equal(result.proposedCreditPoints, 0);
    assert.equal(fixture.writes, 0);
  });

  it("does not create a member when the requested account does not exist", async () => {
    const fixture = serviceFixture({ member: null });

    await assert.rejects(
      fixture.service.previewMember("missing"),
      NotFoundException,
    );
    assert.equal(fixture.writes, 0);
    assert.equal(
      fixture.calls.filter((call) => call.model === "order").length,
      0,
    );
  });
});
