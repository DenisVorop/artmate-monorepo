import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";

import type {
  LoyaltyOperation,
  LoyaltyReservation,
  Prisma,
} from "../src/generated/prisma/client";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";
import { OrdersLoyaltyService } from "../src/orders/orders-loyalty.service";
import {
  createOrderPricingSnapshot,
  type OrderPricingSnapshot,
} from "../src/orders/pricing/pricing-snapshot";
import type { PrismaService } from "../src/prisma/prisma.service";
import { calculatePromoPricing } from "../src/promocodes/pricing";

function baseSnapshot(price = 10_000, quantity = 2) {
  return createOrderPricingSnapshot(
    calculatePromoPricing(
      [{ id: "product-1", unitPriceKopecks: price, quantity }],
      { type: "fixed", amountKopecks: 0 },
    ),
    300,
  );
}

function fixture() {
  const wallet = {
    memberId: "member-1",
    balancePoints: 1000n,
    reservedPoints: 0n,
    revision: 0n,
    updatedAt: new Date(),
  };
  const member = {
    id: "member-1",
    userId: "user-1",
    status: "ACTIVE",
    historyState: "READY",
    user: { status: "ACTIVE", deletedAt: null as Date | null },
    wallet,
  };
  const state = { enrolled: true };
  const base = baseSnapshot();
  const order = {
    id: "order-1",
    checkoutActorUserId: "user-1" as string | null,
    userId: "user-1",
    createdAt: new Date("2026-09-20T12:00:00.000Z"),
    paidAt: null as Date | null,
    terminalPaymentFailedAt: null as Date | null,
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    crmStatus: "NEW",
    paymentMethod: "TBANK_ACQUIRING",
    tbankAcquiringPaymentId: "payment-1",
    currency: "RUB",
    subtotal: "200.00",
    discount: "0.00",
    deliveryPrice: "3.00",
    total: "203.00",
    pricingSnapshot: base,
    items: [
      {
        productId: "product-1",
        price: "100.00",
        quantity: 2,
        lineTotal: "200.00",
      },
    ],
  };
  const operations = new Map<string, LoyaltyOperation>();
  const reservations = new Map<string, LoyaltyReservation>();
  const locks: string[] = [];
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      locks.push(strings.join("?"));
      return [{ id: order.id }];
    },
    order: { findUnique: async () => order },
    loyaltyMember: { findUnique: async () => (state.enrolled ? member : null) },
    loyaltyWallet: {
      findUnique: async () => ({ ...wallet }),
      update: async ({ data }: { data: object }) => Object.assign(wallet, data),
    },
    loyaltyReservation: {
      findUnique: async ({ where }: { where: { orderId: string } }) =>
        reservations.get(where.orderId) ?? null,
      create: async ({ data }: { data: LoyaltyReservation }) => {
        const reservation = {
          ...data,
          id: "reservation-1",
          status: "RESERVED" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        reservations.set(data.orderId, reservation);
        return reservation;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: object;
      }) =>
        Object.assign(
          [...reservations.values()].find((r) => r.id === where.id)!,
          data,
        ),
    },
    loyaltyOperation: {
      findUnique: async ({ where }: { where: { operationKey: string } }) =>
        operations.get(where.operationKey) ?? null,
      create: async ({ data }: { data: LoyaltyOperation }) => {
        const operation = {
          ...data,
          id: `operation-${operations.size + 1}`,
          recordedAt: new Date(),
        };
        operations.set(data.operationKey, operation);
        return operation;
      },
    },
  } as unknown as Prisma.TransactionClient;
  const service = new OrdersLoyaltyService(
    tx as unknown as PrismaService,
    new LoyaltyWalletService(),
  );
  function savePricing(snapshot: OrderPricingSnapshot) {
    order.pricingSnapshot = snapshot;
    order.discount = (snapshot.discountKopecks / 100).toFixed(2);
    order.total = (snapshot.totalKopecks / 100).toFixed(2);
  }
  async function reserve(points = 25) {
    const preview = await service.preview({
      userId: member.userId,
      snapshot: base,
      points,
    });
    const snapshot = await service.reserveInTransaction(tx, {
      userId: member.userId,
      orderId: order.id,
      snapshot: base,
      points,
      pricingRevision: preview.loyalty.pricingRevision,
    });
    savePricing(snapshot);
    return snapshot;
  }
  function markPaid() {
    order.paymentStatus = "PAID";
    order.status = "PAID";
    order.paidAt = new Date("2026-09-20T12:01:00.000Z");
  }
  function markFailed() {
    order.paymentStatus = "FAILED";
    order.terminalPaymentFailedAt = new Date("2026-09-20T12:02:00.000Z");
  }
  const cancellation = () => ({
    orderId: order.id,
    paymentId: "payment-1",
    amountKopecks: order.pricingSnapshot.totalKopecks,
  });
  return {
    service,
    tx,
    state,
    member,
    wallet,
    order,
    operations,
    reservations,
    locks,
    base,
    reserve,
    savePricing,
    markPaid,
    markFailed,
    cancellation,
  };
}

describe("OrdersLoyaltyService settlement", () => {
  it("previews actor balance minus holds, capped by per-unit one-ruble floor, without writes", async () => {
    const f = fixture();
    f.wallet.reservedPoints = 900n;
    const result = await f.service.preview({
      userId: "user-1",
      snapshot: f.base,
      points: 25,
    });
    assert.equal(result.loyalty.availablePoints, 100);
    assert.equal(result.loyalty.maxPoints, 100);
    assert.equal(result.loyalty.discountKopecks, 500);
    assert.equal(result.snapshot.totalKopecks, 19800);
    assert.equal(result.snapshot.deliveryKopecks, 300);
    f.wallet.reservedPoints = 0n;
    const limited = await f.service.preview({
      userId: "user-1",
      snapshot: f.base,
      points: 0,
    });
    assert.equal(limited.loyalty.maxPoints, 990);
    assert.equal(f.operations.size, 0);
    assert.equal(f.reservations.size, 0);
  });

  it("permits no-spend previews but rejects spending for guests, nonmembers, unready and blocked accounts", async () => {
    for (const scenario of [
      "guest",
      "nonmember",
      "pending",
      "failed",
      "blocked",
      "user-blocked",
      "user-deleted",
    ]) {
      const f = fixture();
      if (scenario === "nonmember") f.state.enrolled = false;
      if (scenario === "pending") f.member.historyState = "PENDING";
      if (scenario === "failed") f.member.historyState = "FAILED";
      if (scenario === "blocked") f.member.status = "BLOCKED";
      if (scenario === "user-blocked") f.member.user.status = "BLOCKED";
      if (scenario === "user-deleted") f.member.user.deletedAt = new Date();
      const input = {
        userId: scenario === "guest" ? undefined : "user-1",
        snapshot: f.base,
      };
      const result = await f.service.preview({ ...input, points: 0 });
      assert.equal(result.loyalty.maxPoints, 0, scenario);
      assert.equal(result.loyalty.availablePoints, 0, scenario);
      await assert.rejects(
        f.service.preview({ ...input, points: 1 }),
        ConflictException,
        scenario,
      );
    }
  });

  it("preserves sub-ruble historical pricing for zero points but rejects spending", async () => {
    const f = fixture();
    const snapshot = baseSnapshot(99);
    const preview = await f.service.preview({
      userId: "user-1",
      snapshot,
      points: 0,
    });
    assert.deepEqual(preview.snapshot, snapshot);
    assert.equal(preview.loyalty.maxPoints, 0);
    await assert.rejects(
      f.service.preview({ userId: "user-1", snapshot, points: 1 }),
      ConflictException,
    );
    assert.deepEqual(
      await f.service.reserveInTransaction(f.tx, {
        orderId: f.order.id,
        snapshot,
        points: 0,
      }),
      snapshot,
    );
    assert.equal(f.reservations.size, 0);
  });

  it("rejects stale and missing pricing revisions before a wallet reservation", async () => {
    const f = fixture();
    for (const pricingRevision of [undefined, "stale"]) {
      await assert.rejects(
        f.service.reserveInTransaction(f.tx, {
          orderId: f.order.id,
          userId: "user-1",
          snapshot: f.base,
          points: 25,
          pricingRevision,
        }),
        ConflictException,
      );
    }
    assert.equal(f.operations.size, 0);
    assert.equal(f.reservations.size, 0);
    assert.equal(f.wallet.reservedPoints, 0n);
  });

  it("rechecks available balance after preview and refuses guest-linked or different checkout actors", async () => {
    for (const scenario of ["balance", "guest", "other"]) {
      const f = fixture();
      const preview = await f.service.preview({
        userId: "user-1",
        snapshot: f.base,
        points: 25,
      });
      if (scenario === "balance") f.wallet.reservedPoints = 990n;
      if (scenario === "guest") f.order.checkoutActorUserId = null;
      if (scenario === "other") f.order.checkoutActorUserId = "user-2";
      await assert.rejects(
        f.service.reserveInTransaction(f.tx, {
          orderId: f.order.id,
          userId: "user-1",
          snapshot: f.base,
          points: 25,
          pricingRevision: preview.loyalty.pricingRevision,
        }),
        ConflictException,
      );
      assert.equal(f.operations.size, 0);
    }
  });

  it("invalidates a genuine quote revision when prices or requested points change", async () => {
    const f = fixture();
    const preview = await f.service.preview({
      userId: "user-1",
      snapshot: f.base,
      points: 25,
    });
    for (const update of [
      { snapshot: baseSnapshot(11_000), points: 25 },
      { snapshot: f.base, points: 26 },
    ]) {
      await assert.rejects(
        f.service.reserveInTransaction(f.tx, {
          orderId: f.order.id,
          userId: "user-1",
          ...update,
          pricingRevision: preview.loyalty.pricingRevision,
        }),
        ConflictException,
      );
    }
    assert.equal(f.reservations.size, 0);
    assert.equal(f.operations.size, 0);
  });

  it("reserves with deterministic order identity and createdAt; retries do not duplicate holds", async () => {
    const f = fixture();
    await f.reserve();
    await f.reserve();
    const operation = f.operations.get("order:order-1:reserve")!;
    assert.equal(operation.kind, "RESERVE");
    assert.equal(operation.sourceKey, "order:order-1");
    assert.equal(operation.rulesVersion, "order-spend-v1");
    assert.equal(operation.occurredAt.getTime(), f.order.createdAt.getTime());
    assert.equal(f.wallet.balancePoints, 1000n);
    assert.equal(f.wallet.reservedPoints, 25n);
    assert.equal(f.operations.size, 1);
    assert.match(f.locks[0]!, /orders.*FOR UPDATE/);
  });

  it("consumes once only after PAID plus paidAt and uses a stable payment timestamp", async () => {
    const f = fixture();
    await f.reserve();
    await assert.rejects(
      f.service.consumePaidInTransaction(f.tx, f.order.id),
      ConflictException,
    );
    f.order.paymentStatus = "PAID";
    await assert.rejects(
      f.service.consumePaidInTransaction(f.tx, f.order.id),
      ConflictException,
    );
    f.order.paymentStatus = "PENDING";
    f.order.paidAt = new Date();
    await assert.rejects(
      f.service.consumePaidInTransaction(f.tx, f.order.id),
      ConflictException,
    );
    f.markPaid();
    await f.service.consumePaidInTransaction(f.tx, f.order.id);
    await f.service.consumePaidInTransaction(f.tx, f.order.id);
    const operation = f.operations.get("order:order-1:consume")!;
    assert.equal(operation.occurredAt.getTime(), f.order.paidAt!.getTime());
    assert.equal(f.wallet.balancePoints, 975n);
    assert.equal(f.wallet.reservedPoints, 0n);
    assert.equal(f.operations.size, 2);
  });

  it("rejects missing reservations and amount mismatch for a snapshot with loyalty discount", async () => {
    for (const scenario of ["missing", "mismatch"]) {
      const f = fixture();
      await f.reserve();
      if (scenario === "missing") f.reservations.clear();
      else f.reservations.get(f.order.id)!.points = 26n;
      f.markPaid();
      await assert.rejects(
        f.service.consumePaidInTransaction(f.tx, f.order.id),
        ConflictException,
      );
      f.order.paymentStatus = "FAILED";
      f.order.paidAt = null;
      f.markFailed();
      await assert.rejects(
        f.service.releaseCancelledTBankInTransaction(f.tx, f.cancellation()),
        ConflictException,
      );
      assert.equal(f.operations.size, 1);
    }
  });

  it("rejects settlement if reservation member differs from the verified checkout actor", async () => {
    const f = fixture();
    await f.reserve();
    f.order.checkoutActorUserId = "user-2";
    f.markPaid();
    await assert.rejects(
      f.service.consumePaidInTransaction(f.tx, f.order.id),
      ConflictException,
    );
    f.order.paymentStatus = "FAILED";
    f.order.paidAt = null;
    f.markFailed();
    await assert.rejects(
      f.service.releaseCancelledTBankInTransaction(f.tx, f.cancellation()),
      ConflictException,
    );
    assert.equal(f.wallet.reservedPoints, 25n);
  });

  it("releases only with matching TBank payment, terminal marker, and cash total", async () => {
    for (const scenario of ["provider", "payment", "marker", "amount"]) {
      const f = fixture();
      await f.reserve();
      f.markFailed();
      if (scenario === "provider") f.order.paymentMethod = "OZON_ACQUIRING";
      if (scenario === "payment")
        f.order.tbankAcquiringPaymentId = "payment-new";
      if (scenario === "marker") f.order.terminalPaymentFailedAt = null;
      const input = f.cancellation();
      if (scenario === "amount") input.amountKopecks += 1;
      await assert.rejects(
        f.service.releaseCancelledTBankInTransaction(f.tx, input),
        ConflictException,
      );
      assert.equal(f.wallet.reservedPoints, 25n);
      assert.equal(f.operations.size, 1);
    }
  });

  it("releases once using the persisted failure time and rejects contradictory late payment", async () => {
    const f = fixture();
    await f.reserve();
    f.markFailed();
    await f.service.releaseCancelledTBankInTransaction(f.tx, f.cancellation());
    await f.service.releaseCancelledTBankInTransaction(f.tx, f.cancellation());
    assert.equal(f.wallet.balancePoints, 1000n);
    assert.equal(f.wallet.reservedPoints, 0n);
    assert.equal(f.operations.size, 2);
    assert.equal(
      f.operations.get("order:order-1:release")!.occurredAt.getTime(),
      f.order.terminalPaymentFailedAt!.getTime(),
    );
    f.markPaid();
    await assert.rejects(
      f.service.consumePaidInTransaction(f.tx, f.order.id),
      ConflictException,
    );
  });

  it("does not release a hold after a concurrent paid marker wins", async () => {
    for (const scenario of ["status", "timestamp"]) {
      const f = fixture();
      await f.reserve();
      f.markFailed();
      if (scenario === "status") f.order.paymentStatus = "PAID";
      else f.order.paidAt = new Date();
      await f.service.releaseCancelledTBankInTransaction(
        f.tx,
        f.cancellation(),
      );
      assert.equal(f.wallet.reservedPoints, 25n);
      assert.equal(f.operations.size, 1);
    }
  });

  it("ordinary orders without loyalty remain settlement no-ops", async () => {
    const f = fixture();
    await f.service.consumePaidInTransaction(f.tx, f.order.id);
    await f.service.releaseCancelledTBankInTransaction(f.tx, f.cancellation());
    assert.equal(f.operations.size, 0);
  });

  it("rejects noninteger points and inconsistent wallets before generating a quote", async () => {
    const f = fixture();
    for (const points of [
      -1,
      0.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      await assert.rejects(
        f.service.preview({ userId: "user-1", snapshot: f.base, points }),
        BadRequestException,
      );
    }
    f.wallet.reservedPoints = 1001n;
    await assert.rejects(
      f.service.preview({ userId: "user-1", snapshot: f.base, points: 0 }),
      ConflictException,
    );
  });
});
