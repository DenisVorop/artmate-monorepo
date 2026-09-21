import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  Order,
  OrderPaymentRecovery,
} from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { OrdersService } from "../src/orders/orders.service";
import { PaymentRecoveryService } from "../src/orders/payment-recovery/payment-recovery.service";
import { PaymentRecoveryWorker } from "../src/orders/payment-recovery/payment-recovery.worker";

function fixture() {
  const order = {
    id: "order-1",
    paymentStatus: "PENDING",
    paidAt: null,
    paymentMethod: "TBANK_ACQUIRING",
    paymentRedirectUrl: "/checkout/payment-initializing?startedAt=123",
    ozonAcquiringOrderId: null,
    ozonAcquiringPaymentId: null,
    tbankAcquiringOrderId: null,
    tbankAcquiringPaymentId: null,
  } as Order;
  const state = {
    job: null as OrderPaymentRecovery | null,
    writes: 0,
    transactions: 0,
    now: null as Date | null,
  };
  const locks: string[] = [];
  function mutate(data: Record<string, unknown>) {
    state.writes += 1;
    assert.ok(state.job);
    const attempts =
      typeof data.attempts === "object" && data.attempts
        ? state.job.attempts +
          (data.attempts as { increment: number }).increment
        : data.attempts;
    Object.assign(
      state.job,
      data,
      ...(attempts === undefined ? [] : [{ attempts }]),
    );
    return { ...state.job };
  }
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      locks.push(strings.join("?"));
      if (strings.join("?").includes("SELECT clock_timestamp()"))
        return [{ now: state.now ?? new Date() }];
      if (
        strings.join("?").includes("JOIN order_payment_recoveries") &&
        state.job?.status !== "PENDING" &&
        state.job?.status !== "CHECKING"
      )
        return [];
      return state.job ? [{ id: order.id }] : [];
    },
    order: { findUnique: async () => order },
    orderPaymentRecovery: {
      findUnique: async () => (state.job ? { ...state.job } : null),
      update: async ({ data }: { data: Record<string, unknown> }) =>
        mutate(data),
    },
  };
  const prisma = {
    ...tx,
    $transaction: async <T>(fn: (value: typeof tx) => Promise<T>) => {
      state.transactions += 1;
      return fn(tx);
    },
  } as unknown as PrismaService;
  const service = new PaymentRecoveryService(prisma);
  async function queue() {
    // Fixture represents the job persisted by checkout before the bank request.
    state.job = {
      orderId: order.id,
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: state.now ?? new Date(0),
      leaseToken: null,
      lockedUntil: null,
      finishedAt: null,
      lastCheckedAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  return { order, state, locks, service, queue };
}

describe("PaymentRecoveryService", () => {
  it("claims only a persisted job without modifying payment state", async () => {
    const f = fixture();
    assert.equal(await f.service.claimNext(), null);
    assert.equal(f.state.writes, 0);
    await f.queue();
    const source = { ...f.order };
    assert.ok(await f.service.claimNext());
    assert.deepEqual(f.order, source);
    assert.equal(f.state.job?.status, "CHECKING");
    assert.equal(f.state.job?.attempts, 1);
    assert.equal(await f.service.claimNext(), null);
  });

  it("reclaims expired leases and fences stale or expired completions", async () => {
    const f = fixture();
    await f.queue();
    const old = (await f.service.claimNext())!;
    assert.equal(await f.service.claimNext(), null);
    f.state.job!.lockedUntil = new Date(0);
    assert.equal(await f.service.settle(old, { state: "pending" }), false);
    const current = (await f.service.claimNext())!;
    assert.notEqual(current.leaseToken, old.leaseToken);
    assert.equal(await f.service.settle(old, { state: "attention" }), false);
    assert.equal(f.state.job?.leaseToken, current.leaseToken);
    assert.equal(await f.service.settle(current, { state: "pending" }), true);
    assert.equal(f.state.job?.status, "PENDING");
    assert.equal(f.state.job?.attempts, 2);
    assert.equal(f.state.job?.leaseToken, null);
  });

  it("uses database time for lease expiry even when the host clock differs", async () => {
    const f = fixture();
    f.state.now = new Date("2040-01-01T00:00:00.000Z");
    await f.queue();
    const lease = (await f.service.claimNext())!;
    assert.equal(
      f.state.job?.lockedUntil?.toISOString(),
      "2040-01-01T00:02:00.000Z",
    );
    f.state.now = new Date("2040-01-01T00:02:00.001Z");
    assert.equal(await f.service.settle(lease, { state: "pending" }), false);
    assert.equal(f.state.job?.status, "CHECKING");
  });

  it("sanitizes errors and caps automatic attempts into attention without marking orders failed", async () => {
    const f = fixture();
    await f.queue();
    const lease = (await f.service.claimNext())!;
    await f.service.settle(lease, {
      state: "pending",
      reason: "SECRET response from provider",
    });
    assert.equal(f.state.job?.lastError, "provider_error");
    assert.ok(f.state.job!.nextAttemptAt.getTime() >= Date.now() + 59000);
    f.state.job!.attempts = 11;
    f.state.job!.nextAttemptAt = new Date(0);
    const last = (await f.service.claimNext())!;
    await f.service.settle(last, { state: "pending" });
    assert.equal(f.state.job?.status, "ATTENTION");
    assert.equal(f.state.job?.lastError, "retry_limit");
    assert.equal(f.order.paymentStatus, "PENDING");
    assert.equal(await f.service.claimNext(), null);
  });

  it("does not trust a final worker result without its durable order fact", async () => {
    const f = fixture();
    await f.queue();
    const lease = (await f.service.claimNext())!;
    await f.service.settle(lease, { state: "paid" });
    assert.equal(f.state.job?.status, "ATTENTION");
    assert.equal(f.state.job?.finishedAt, null);
    const paid = fixture();
    await paid.queue();
    const next = (await paid.service.claimNext())!;
    paid.order.paymentStatus = "CLOSED_UNPAID";
    await paid.service.settle(next, { state: "pending" });
    assert.equal(paid.state.job?.status, "RESOLVED");
    assert.ok(paid.state.job?.finishedAt);
    assert.equal(paid.state.job?.lastError, null);
  });

  it("claim rechecks live state and stops exhausted or already finalized jobs", async () => {
    const f = fixture();
    await f.queue();
    f.state.job!.attempts = 12;
    assert.equal(await f.service.claimNext(), null);
    assert.equal(f.state.job?.status, "ATTENTION");
    const paid = fixture();
    await paid.queue();
    paid.order.paymentStatus = "PAID";
    assert.equal(await paid.service.claimNext(), null);
    assert.equal(paid.state.job?.status, "RESOLVED");
  });
});

describe("PaymentRecoveryWorker", () => {
  it("provider errors persist retry without any payment initialization call", async () => {
    const f = fixture();
    await f.queue();
    let reconciles = 0;
    const orders = {
      reconcilePayment: async (orderId: string) => {
        assert.equal(orderId, f.order.id);
        reconciles += 1;
        throw new Error("secret");
      },
      initializePayment: () =>
        assert.fail("worker must never initialize payment"),
    } as unknown as OrdersService;
    const worker = new PaymentRecoveryWorker(f.service, orders);
    await worker.poll();
    worker.onModuleDestroy();
    assert.equal(reconciles, 1);
    assert.equal(f.state.job?.status, "PENDING");
    assert.equal(f.state.job?.lastError, "provider_error");
    await worker.poll();
    assert.equal(reconciles, 1);
  });
});
