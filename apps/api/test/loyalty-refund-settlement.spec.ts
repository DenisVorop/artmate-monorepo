import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";

import { LoyaltyRefundSettlementService } from "../src/loyalty/refund-settlement.service";
import { LoyaltyRefundSettlementWorker } from "../src/loyalty/refund-settlement.worker";
import type { LoyaltyWalletService } from "../src/loyalty/wallet.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { createOrderPricingSnapshot } from "../src/orders/pricing/pricing-snapshot";
import { applyLoyaltyPoints } from "../src/orders/pricing/apply-loyalty-points";
import { calculatePromoPricing } from "../src/promocodes/pricing";

type Receipt = {
  eventId: string;
  processedAt: Date | null;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
};
type Refund = {
  id: string;
  orderId: string;
  createdAt: Date;
  deliveryKopecks: bigint;
  totalKopecks: bigint;
  loyaltyPoints: bigint;
  items: {
    productId: string;
    previousQuantity: number;
    quantity: number;
    amountKopecks: bigint;
    loyaltyPoints: bigint;
  }[];
};

function fixture() {
  const snapshot = applyLoyaltyPoints(
    createOrderPricingSnapshot(
      calculatePromoPricing(
        [{ id: "product-1", unitPriceKopecks: 1_000, quantity: 3 }],
        { type: "fixed", amountKopecks: 0 },
      ),
      300,
    ),
    5,
  );
  const time = new Date("2026-09-20T13:00:00.000Z");
  const events = new Map([
    ["event-1", { id: "event-1", refundId: "refund-1", occurredAt: time }],
    ["event-2", { id: "event-2", refundId: "refund-2", occurredAt: time }],
  ]);
  const refunds = new Map<string, Refund>([
    [
      "refund-1",
      {
        id: "refund-1",
        orderId: "order-1",
        createdAt: time,
        deliveryKopecks: 0n,
        totalKopecks: 960n,
        loyaltyPoints: 2n,
        items: [
          {
            productId: "product-1",
            previousQuantity: 0,
            quantity: 1,
            amountKopecks: 960n,
            loyaltyPoints: 2n,
          },
        ],
      },
    ],
    [
      "refund-2",
      {
        id: "refund-2",
        orderId: "order-1",
        createdAt: time,
        deliveryKopecks: 0n,
        totalKopecks: 1_940n,
        loyaltyPoints: 3n,
        items: [
          {
            productId: "product-1",
            previousQuantity: 1,
            quantity: 2,
            amountKopecks: 1_940n,
            loyaltyPoints: 3n,
          },
        ],
      },
    ],
  ]);
  const order = {
    id: "order-1",
    checkoutActorUserId: "user-1",
    paymentStatus: "PAID",
    paidAt: time as Date | null,
    pricingSnapshot: snapshot,
    currency: "RUB",
    subtotal: "30.00",
    discount: "1.00",
    total: "32.00",
    deliveryPrice: "3.00",
    items: [
      {
        productId: "product-1",
        price: "10.00",
        quantity: 3,
        lineTotal: "30.00",
      },
    ],
  };
  const receipts = new Map<string, Receipt>();
  const calls: string[] = [];
  const locks: string[] = [];
  const state = {
    balance: 95n,
    reservationStatus: "CONSUMED",
    failWallet: false,
    failReceipt: false,
  };
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      locks.push(strings.join("?"));
      return [];
    },
    order: { findUnique: async () => order },
    orderRefund: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        refunds.get(where.id) ?? null,
    },
    loyaltyRefundReceipt: {
      findUnique: async ({ where }: { where: { eventId: string } }) =>
        receipts.get(where.eventId) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { eventId: string };
        create: Receipt;
        update: Partial<Receipt>;
      }) => {
        if (state.failReceipt && (create.processedAt || update.processedAt))
          throw new Error("receipt failed");
        const existing = receipts.get(where.eventId);
        const receipt = existing
          ? { ...existing, ...update }
          : {
              ...create,
              processedAt: create.processedAt ?? null,
              lastError: create.lastError ?? null,
            };
        receipts.set(where.eventId, receipt);
        return receipt;
      },
    },
  };
  const prisma = {
    orderRefundEvent: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        events.get(where.id) ?? null,
    },
    orderRefund: tx.orderRefund,
    $queryRaw: async () => [...events.values()].map(({ id }) => ({ id })),
    $transaction: async <T>(run: (client: typeof tx) => Promise<T>) => {
      const before = {
        balance: state.balance,
        calls: [...calls],
        receipts: structuredClone(receipts),
      };
      try {
        return await run(tx);
      } catch (error) {
        state.balance = before.balance;
        calls.splice(0, calls.length, ...before.calls);
        receipts.clear();
        for (const [id, receipt] of before.receipts) receipts.set(id, receipt);
        throw error;
      }
    },
  } as unknown as PrismaService;
  const wallet = {
    restoreRefundInTransaction: async (
      client: unknown,
      { refundId }: { refundId: string },
    ) => {
      assert.equal(client, tx);
      if (state.failWallet || state.reservationStatus !== "CONSUMED")
        throw new ConflictException("Wallet failure with private details");
      calls.push(refundId);
      state.balance += refunds.get(refundId)!.loyaltyPoints;
    },
  } as unknown as LoyaltyWalletService;
  const service = new LoyaltyRefundSettlementService(prisma, wallet);
  return { service, events, refunds, receipts, calls, locks, state, order };
}

describe("LoyaltyRefundSettlementService", () => {
  it("restores exact ordinal units even when refund events arrive backwards and never restores twice", async () => {
    const f = fixture();
    assert.deepEqual(await f.service.processEvent("event-2"), {
      processed: true,
      replayed: false,
    });
    assert.equal(f.state.balance, 98n);
    await f.service.processEvent("event-1");
    assert.equal(f.state.balance, 100n);
    assert.deepEqual(await f.service.processEvent("event-2"), {
      processed: true,
      replayed: true,
    });
    assert.deepEqual(f.calls, ["refund-2", "refund-1"]);
    assert.match(f.locks[0]!, /orders.*FOR UPDATE/);
    assert.ok(f.receipts.get("event-1")!.processedAt);
  });

  it("leaves refund-before-consume pending and retries after the payment consumer finishes", async () => {
    const f = fixture();
    f.state.reservationStatus = "RESERVED";
    await assert.rejects(f.service.processEvent("event-1"), ConflictException);
    assert.equal(f.state.balance, 95n);
    assert.equal(f.order.paymentStatus, "PAID");
    assert.equal(f.refunds.get("refund-1")!.loyaltyPoints, 2n);
    const failed = f.receipts.get("event-1")!;
    assert.equal(failed.processedAt, null);
    assert.equal(failed.lastError, "refund_settlement_failed");
    assert.equal(failed.attempts, 1);
    assert.ok(failed.nextAttemptAt.getTime() > Date.now());
    f.state.reservationStatus = "CONSUMED";
    await f.service.processEvent("event-1");
    assert.equal(f.state.balance, 97n);
    assert.equal(f.receipts.get("event-1")!.attempts, 2);
    assert.equal(f.receipts.get("event-1")!.lastError, null);
  });

  it("validates delivery-only refunds and records zero-point receipt without touching wallet", async () => {
    const f = fixture();
    Object.assign(f.refunds.get("refund-1")!, {
      items: [],
      deliveryKopecks: 300n,
      totalKopecks: 300n,
      loyaltyPoints: 0n,
    });
    f.state.failWallet = true;
    await f.service.processEvent("event-1");
    assert.deepEqual(f.calls, []);
    assert.ok(f.receipts.get("event-1")!.processedAt);
    assert.equal(f.state.balance, 95n);
  });

  it("rejects tampered ordinals, cash and points, duplicates, unknown products and totals above the paid order", async () => {
    const mutations: ((refund: Refund) => void)[] = [
      (r) => {
        r.items[0]!.previousQuantity = -1;
      },
      (r) => {
        r.items[0]!.previousQuantity = 3;
      },
      (r) => {
        r.items[0]!.previousQuantity = 0.5;
      },
      (r) => {
        r.items[0]!.quantity = 0;
      },
      (r) => {
        r.items[0]!.quantity = 4;
      },
      (r) => {
        r.items[0]!.amountKopecks = -1n;
      },
      (r) => {
        r.items[0]!.amountKopecks += 1n;
      },
      (r) => {
        r.items[0]!.loyaltyPoints += 1n;
      },
      (r) => {
        r.items[0]!.productId = "unknown";
      },
      (r) => {
        r.items.push({ ...r.items[0]! });
      },
      (r) => {
        r.loyaltyPoints = -1n;
      },
      (r) => {
        r.loyaltyPoints += 1n;
      },
      (r) => {
        r.loyaltyPoints = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
      },
      (r) => {
        r.totalKopecks += 1n;
      },
      (r) => {
        r.totalKopecks = 3_201n;
      },
      (r) => {
        r.deliveryKopecks = 301n;
      },
    ];
    for (const mutate of mutations) {
      const f = fixture();
      mutate(f.refunds.get("refund-1")!);
      await assert.rejects(f.service.processEvent("event-1"));
      assert.equal(f.calls.length, 0);
      assert.equal(f.receipts.get("event-1")!.processedAt, null);
    }
  });

  it("requires source timestamp, paid state and immutable order pricing to match", async () => {
    for (const scenario of ["time", "unpaid", "no-paid-time", "snapshot"]) {
      const f = fixture();
      if (scenario === "time")
        f.events.get("event-1")!.occurredAt = new Date(0);
      if (scenario === "unpaid") f.order.paymentStatus = "PENDING";
      if (scenario === "no-paid-time") f.order.paidAt = null;
      if (scenario === "snapshot")
        f.order.pricingSnapshot.items[0]!.totalKopecks += 1;
      await assert.rejects(f.service.processEvent("event-1"));
      assert.equal(f.calls.length, 0);
      assert.equal(
        f.receipts.get("event-1")!.lastError,
        "refund_settlement_failed",
      );
    }
  });

  it("rolls back restoration if receipt persistence fails and retries from the durable refund", async () => {
    const f = fixture();
    f.state.failReceipt = true;
    await assert.rejects(f.service.processEvent("event-1"), /receipt failed/);
    assert.equal(f.state.balance, 95n);
    assert.equal(f.calls.length, 0);
    assert.equal(f.refunds.get("refund-1")!.totalKopecks, 960n);
    assert.equal(f.receipts.get("event-1")!.processedAt, null);
    f.state.failReceipt = false;
    await f.service.processEvent("event-1");
    assert.equal(f.state.balance, 97n);
  });

  it("continues polling other events after failure and validates batch bounds", async () => {
    const f = fixture();
    f.refunds.get("refund-1")!.loyaltyPoints = 999n;
    const warnings: string[] = [];
    Object.assign(f.service, {
      logger: { warn: (message: string) => warnings.push(message) },
    });
    await f.service.processDueEvents();
    assert.equal(f.receipts.get("event-1")!.processedAt, null);
    assert.ok(f.receipts.get("event-2")!.processedAt);
    assert.deepEqual(f.calls, ["refund-2"]);
    assert.equal(warnings.length, 1);
    for (const limit of [0, 101, 0.5, NaN])
      await assert.rejects(f.service.processDueEvents(limit), RangeError);
  });

  it("does not fabricate a receipt for an unknown event", async () => {
    const f = fixture();
    await assert.rejects(f.service.processEvent("unknown"), /not found/);
    assert.equal(f.receipts.size, 0);
  });
});

describe("LoyaltyRefundSettlementWorker", () => {
  it("does not overlap polls, releases the latch after failure, and stops on destroy", async () => {
    let finish!: () => void;
    let calls = 0;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const worker = new LoyaltyRefundSettlementWorker({
      processDueEvents: async () => {
        calls += 1;
        await gate;
        throw new Error("failure");
      },
    } as unknown as LoyaltyRefundSettlementService);
    const warnings: string[] = [];
    Object.assign(worker, {
      logger: { warn: (message: string) => warnings.push(message) },
    });
    const pending = worker.poll();
    await worker.poll();
    assert.equal(calls, 1);
    finish();
    await pending;
    await worker.poll();
    assert.equal(calls, 2);
    assert.equal(warnings.length, 2);
    worker.onModuleDestroy();
    await worker.poll();
    assert.equal(calls, 2);
  });

  it("starts with an immediate poll and an unref timer which is cleared on destroy", async () => {
    let calls = 0;
    const worker = new LoyaltyRefundSettlementWorker({
      processDueEvents: async () => {
        calls += 1;
      },
    } as unknown as LoyaltyRefundSettlementService);
    worker.onModuleInit();
    const timer = (worker as unknown as { timer: NodeJS.Timeout }).timer;
    assert.equal(timer.hasRef(), false);
    assert.equal(calls, 1);
    worker.onModuleInit();
    assert.equal(calls, 1);
    worker.onModuleDestroy();
    assert.equal(
      (worker as unknown as { timer?: NodeJS.Timeout }).timer,
      undefined,
    );
    await worker.poll();
    assert.equal(calls, 1);
  });
});
