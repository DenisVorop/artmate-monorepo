import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";

import type {
  LoyaltyPaymentReceipt,
  OrderPaymentEvent,
} from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { LoyaltyPaymentSettlementService } from "../src/loyalty/payment-settlement.service";
import { LoyaltyPaymentSettlementWorker } from "../src/loyalty/payment-settlement.worker";
import type { LoyaltyWalletService } from "../src/loyalty/wallet.service";
import { createOrderPricingSnapshot } from "../src/orders/pricing/pricing-snapshot";
import { applyLoyaltyPoints } from "../src/orders/pricing/apply-loyalty-points";
import { calculatePromoPricing } from "../src/promocodes/pricing";

function fixture() {
  const snapshot = applyLoyaltyPoints(
    createOrderPricingSnapshot(
      calculatePromoPricing(
        [{ id: "product-1", unitPriceKopecks: 10000, quantity: 1 }],
        { type: "fixed", amountKopecks: 0 },
      ),
      300,
    ),
    25,
  );
  const paidAt = new Date("2026-09-20T12:01:00.000Z");
  const closedAt = new Date("2026-09-20T12:02:00.000Z");
  const event: OrderPaymentEvent = {
    id: "event-1",
    orderId: "order-1",
    kind: "PAID",
    occurredAt: paidAt,
    createdAt: paidAt,
  };
  const order = {
    id: event.orderId,
    checkoutActorUserId: "user-1",
    paymentStatus: "PAID",
    paidAt: paidAt as Date | null,
    paymentClosedUnpaidAt: null as Date | null,
    pricingSnapshot: snapshot,
    subtotal: "100.00",
    discount: "5.00",
    total: "98.00",
    deliveryPrice: "3.00",
    currency: "RUB",
    items: [
      {
        productId: "product-1",
        price: "100.00",
        quantity: 1,
        lineTotal: "100.00",
      },
    ],
  };
  const member = { userId: "user-1" };
  const state = {
    reservation: { memberId: "member-1", points: 25n, status: "RESERVED" } as {
      memberId: string;
      points: bigint;
      status: string;
    } | null,
    failWallet: false,
    failReceipt: false,
    txCount: 0,
  };
  const receipts = new Map<string, LoyaltyPaymentReceipt>();
  const calls: Array<{
    kind: "consume" | "release";
    input: Record<string, unknown>;
  }> = [];
  const locks: string[] = [];
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      locks.push(strings.join("?"));
      return [{ id: order.id }];
    },
    order: { findUnique: async () => order },
    loyaltyReservation: { findUnique: async () => state.reservation },
    loyaltyMember: { findUnique: async () => member },
    loyaltyPaymentReceipt: {
      findUnique: async ({ where }: { where: { eventId: string } }) =>
        receipts.get(where.eventId) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { eventId: string };
        create: LoyaltyPaymentReceipt;
        update: Partial<LoyaltyPaymentReceipt>;
      }) => {
        if (state.failReceipt && (create.processedAt || update.processedAt))
          throw new Error("receipt write failed");
        const existing = receipts.get(where.eventId);
        const receipt = existing
          ? { ...existing, ...update }
          : {
              ...create,
              processedAt: create.processedAt ?? null,
              lastError: create.lastError ?? null,
              updatedAt: new Date(),
            };
        receipts.set(where.eventId, receipt);
        return receipt;
      },
    },
  };
  const prisma = {
    orderPaymentEvent: { findUnique: async () => event },
    $queryRaw: async () => [{ id: event.id }],
    $transaction: async <T>(fn: (transaction: typeof tx) => Promise<T>) => {
      state.txCount += 1;
      const savedReceipt = new Map(receipts);
      const savedCalls = [...calls];
      const savedStatus = state.reservation?.status;
      try {
        return await fn(tx);
      } catch (error) {
        receipts.clear();
        for (const [key, value] of savedReceipt) receipts.set(key, value);
        calls.splice(0, calls.length, ...savedCalls);
        if (state.reservation && savedStatus)
          state.reservation.status = savedStatus;
        throw error;
      }
    },
  } as unknown as PrismaService;
  const wallet = {
    consumeInTransaction: async (
      _tx: unknown,
      input: Record<string, unknown>,
    ) => {
      if (state.failWallet || state.reservation?.status === "RELEASED")
        throw new ConflictException(
          "Wallet failed with secret provider response",
        );
      calls.push({ kind: "consume", input });
      if (state.reservation) state.reservation.status = "CONSUMED";
    },
    releaseInTransaction: async (
      _tx: unknown,
      input: Record<string, unknown>,
    ) => {
      if (state.failWallet || state.reservation?.status === "CONSUMED")
        throw new ConflictException("Wallet failed");
      calls.push({ kind: "release", input });
      if (state.reservation) state.reservation.status = "RELEASED";
    },
  } as unknown as LoyaltyWalletService;
  const service = new LoyaltyPaymentSettlementService(prisma, wallet);
  function close() {
    event.kind = "CLOSED_UNPAID";
    event.occurredAt = closedAt;
    order.paymentStatus = "CLOSED_UNPAID";
    order.paidAt = null;
    order.paymentClosedUnpaidAt = closedAt;
  }
  return {
    service,
    state,
    event,
    order,
    member,
    receipts,
    calls,
    locks,
    close,
    paidAt,
    closedAt,
  };
}

describe("LoyaltyPaymentSettlementService", () => {
  it("atomically consumes a PAID fact and records receipt; repeated event is a no-op", async () => {
    const f = fixture();
    assert.deepEqual(await f.service.processEvent(f.event.id), {
      processed: true,
      replayed: false,
    });
    assert.deepEqual(await f.service.processEvent(f.event.id), {
      processed: true,
      replayed: true,
    });
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0]?.kind, "consume");
    assert.equal(f.calls[0]?.input.operationKey, "order:order-1:consume");
    assert.equal(f.calls[0]?.input.occurredAt, f.paidAt);
    assert.ok(f.receipts.get(f.event.id)?.processedAt);
    assert.match(f.locks[0]!, /orders.*FOR UPDATE/);
  });

  it("releases only provider-neutral CLOSED_UNPAID with its durable timestamp", async () => {
    const f = fixture();
    f.close();
    await f.service.processEvent(f.event.id);
    assert.equal(f.calls[0]?.kind, "release");
    assert.equal(f.calls[0]?.input.operationKey, "order:order-1:release");
    assert.equal(f.calls[0]?.input.occurredAt, f.closedAt);
    assert.ok(f.receipts.get(f.event.id)?.processedAt);
  });

  it("does not infer final closure from FAILED or missing terminal timestamps", async () => {
    for (const scenario of [
      "failed",
      "missing-closed-at",
      "missing-paid-at",
      "paid-event-on-closed",
    ]) {
      const f = fixture();
      if (scenario === "missing-paid-at") f.order.paidAt = null;
      else {
        f.close();
        if (scenario === "failed") f.order.paymentStatus = "FAILED";
        if (scenario === "missing-closed-at")
          f.order.paymentClosedUnpaidAt = null;
        if (scenario === "paid-event-on-closed") f.event.kind = "PAID";
      }
      await assert.rejects(
        f.service.processEvent(f.event.id),
        ConflictException,
      );
      assert.equal(f.calls.length, 0);
      assert.equal(f.receipts.get(f.event.id)?.processedAt, null);
    }
  });

  it("stale closure follows the winning PAID order and never releases its hold", async () => {
    const f = fixture();
    f.event.kind = "CLOSED_UNPAID";
    f.event.occurredAt = f.closedAt;
    f.order.paymentClosedUnpaidAt = f.closedAt;
    await f.service.processEvent(f.event.id);
    assert.equal(f.calls[0]?.kind, "consume");
    assert.equal(f.calls[0]?.input.occurredAt, f.paidAt);
  });

  it("requires event timestamps to match the durable source fact", async () => {
    for (const kind of ["paid", "closed"]) {
      const f = fixture();
      if (kind === "closed") f.close();
      f.event.occurredAt = new Date(f.event.occurredAt.getTime() + 1);
      await assert.rejects(
        f.service.processEvent(f.event.id),
        ConflictException,
      );
      assert.equal(f.calls.length, 0);
      assert.equal(f.receipts.get(f.event.id)?.processedAt, null);
    }
  });

  it("keeps missing/mismatched reservation and wrong checkout actor events pending", async () => {
    for (const scenario of ["missing", "points", "owner"]) {
      const f = fixture();
      if (scenario === "missing") f.state.reservation = null;
      if (scenario === "points") f.state.reservation!.points = 26n;
      if (scenario === "owner") f.order.checkoutActorUserId = "other-user";
      await assert.rejects(
        f.service.processEvent(f.event.id),
        ConflictException,
      );
      assert.equal(f.calls.length, 0);
      assert.equal(f.receipts.get(f.event.id)?.lastError, "settlement_failed");
    }
  });

  it("persists retry after wallet failure without changing source fact; recovers later", async () => {
    const f = fixture();
    f.state.failWallet = true;
    const before = Date.now();
    await assert.rejects(f.service.processEvent(f.event.id), ConflictException);
    assert.equal(f.event.kind, "PAID");
    assert.equal(f.order.paymentStatus, "PAID");
    assert.equal(f.receipts.get(f.event.id)?.attempts, 1);
    assert.equal(f.receipts.get(f.event.id)?.lastError, "settlement_failed");
    assert.ok(
      f.receipts.get(f.event.id)!.nextAttemptAt.getTime() >= before + 15000,
    );
    assert.equal(f.state.txCount, 2);
    f.state.failWallet = false;
    await f.service.processEvent(f.event.id);
    assert.equal(f.receipts.get(f.event.id)?.attempts, 2);
    assert.equal(f.receipts.get(f.event.id)?.lastError, null);
    assert.ok(f.receipts.get(f.event.id)?.processedAt);
  });

  it("rolls wallet mutation back if receipt fails, then retries the entire atomic settlement", async () => {
    const f = fixture();
    f.state.failReceipt = true;
    await assert.rejects(
      f.service.processEvent(f.event.id),
      /receipt write failed/,
    );
    assert.equal(f.state.reservation?.status, "RESERVED");
    assert.equal(f.calls.length, 0);
    assert.equal(f.receipts.get(f.event.id)?.processedAt, null);
    f.state.failReceipt = false;
    await f.service.processEvent(f.event.id);
    assert.equal(f.state.reservation?.status, "CONSUMED");
  });

  it("does not forgive a late paid fact after the reservation was already released", async () => {
    const f = fixture();
    f.state.reservation!.status = "RELEASED";
    await assert.rejects(f.service.processEvent(f.event.id), ConflictException);
    assert.equal(f.receipts.get(f.event.id)?.processedAt, null);
    assert.equal(f.state.reservation?.status, "RELEASED");
  });

  it("acknowledges ordinary paid orders without trying to mutate a wallet", async () => {
    const f = fixture();
    f.state.reservation = null;
    f.order.pricingSnapshot = createOrderPricingSnapshot(
      calculatePromoPricing(
        [{ id: "product-1", unitPriceKopecks: 10000, quantity: 1 }],
        { type: "fixed", amountKopecks: 0 },
      ),
      300,
    );
    f.order.discount = "0.00";
    f.order.total = "103.00";
    await f.service.processEvent(f.event.id);
    assert.equal(f.calls.length, 0);
    assert.ok(f.receipts.get(f.event.id)?.processedAt);
  });

  it("polls durable events and catches one failed event without losing its retry", async () => {
    const f = fixture();
    f.state.failWallet = true;
    await f.service.processDueEvents();
    assert.equal(f.receipts.get(f.event.id)?.attempts, 1);
    f.state.failWallet = false;
    await f.service.processDueEvents();
    assert.ok(f.receipts.get(f.event.id)?.processedAt);
    await assert.rejects(f.service.processDueEvents(101), RangeError);
  });
});

describe("LoyaltyPaymentSettlementWorker", () => {
  it("does not overlap polls, clears its interval and ignores polls after shutdown", async () => {
    let finish: (() => void) | undefined;
    let count = 0;
    const service = {
      processDueEvents: async () => {
        count += 1;
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      },
    } as unknown as LoyaltyPaymentSettlementService;
    const worker = new LoyaltyPaymentSettlementWorker(service);
    worker.onModuleInit();
    await worker.poll();
    assert.equal(count, 1);
    worker.onModuleDestroy();
    finish!();
    await worker.poll();
    assert.equal(count, 1);
  });
});
