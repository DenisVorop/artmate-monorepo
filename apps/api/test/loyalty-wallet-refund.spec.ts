import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";

import type { LoyaltyOperation, Prisma } from "../src/generated/prisma/client";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";

function fixture() {
  const refund = {
    id: "refund-1",
    orderId: "order-1",
    loyaltyPoints: 10n,
    createdAt: new Date("2026-09-20T12:00:00Z"),
  };
  const order = {
    id: "order-1",
    checkoutActorUserId: "user-1" as string | null,
    paymentStatus: "PAID",
    paidAt: new Date() as Date | null,
  };
  const member = {
    id: "member-1",
    userId: "user-1",
    status: "ACTIVE",
    historyState: "READY",
  };
  const wallet = {
    memberId: member.id,
    balancePoints: 5n,
    reservedPoints: 0n,
    revision: 3n,
    updatedAt: new Date(),
  };
  const reservation = {
    id: "reservation-1",
    memberId: member.id,
    orderId: order.id,
    points: 25n,
    status: "CONSUMED",
  };
  const state = { refundExists: true, reservationExists: true };
  const operations = new Map<string, LoyaltyOperation>();
  const locks: string[] = [];
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      locks.push(strings.join("?"));
      return [{ id: order.id }];
    },
    orderRefund: {
      findUnique: async () => (state.refundExists ? refund : null),
    },
    order: { findUnique: async () => order },
    loyaltyMember: { findUnique: async () => member },
    loyaltyReservation: {
      findUnique: async () => (state.reservationExists ? reservation : null),
    },
    loyaltyWallet: {
      findUnique: async () => ({ ...wallet }),
      update: async ({ data }: { data: object }) => Object.assign(wallet, data),
    },
    loyaltyOperation: {
      findUnique: async ({ where }: { where: { operationKey: string } }) =>
        operations.get(where.operationKey) ?? null,
      aggregate: async () => ({
        _sum: {
          requestedPoints: [...operations.values()]
            .filter((op) => op.kind === "RESTORE")
            .reduce((sum, op) => sum + op.requestedPoints, 0n),
        },
      }),
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
  const service = new LoyaltyWalletService();
  const restore = () =>
    service.restoreRefundInTransaction(tx, { refundId: refund.id });
  return {
    refund,
    order,
    member,
    wallet,
    reservation,
    state,
    operations,
    locks,
    tx,
    service,
    restore,
  };
}

describe("LoyaltyWalletService refund restoration", () => {
  it("restores exactly stored refund points with immutable source identity and order/member lock order", async () => {
    const f = fixture();
    const result = await f.restore();
    assert.equal(result.replayed, false);
    assert.equal(result.operation.kind, "RESTORE");
    assert.equal(result.operation.requestedPoints, 10n);
    assert.equal(result.operation.balanceDelta, 10n);
    assert.equal(result.operation.reservedDelta, 0n);
    assert.equal(result.operation.refundId, f.refund.id);
    assert.equal(result.operation.reservationId, f.reservation.id);
    assert.equal(result.operation.operationKey, "refund:refund-1:restore");
    assert.equal(result.operation.sourceKey, "refund:refund-1");
    assert.equal(result.operation.rulesVersion, "order-spend-v1");
    assert.equal(result.operation.occurredAt, f.refund.createdAt);
    assert.equal(f.wallet.balancePoints, 15n);
    assert.equal(f.wallet.revision, 4n);
    assert.equal(f.reservation.status, "CONSUMED");
    assert.match(f.locks[0]!, /orders.*FOR UPDATE/);
    assert.match(f.locks[1]!, /loyalty_members.*FOR UPDATE/);
  });

  it("allows restoring spent points to blocked members and replays once", async () => {
    const f = fixture();
    f.member.status = "BLOCKED";
    f.member.historyState = "FAILED";
    const first = await f.restore();
    const replay = await f.restore();
    assert.equal(replay.replayed, true);
    assert.equal(replay.operation.id, first.operation.id);
    assert.equal(f.operations.size, 1);
    assert.equal(f.wallet.balancePoints, 15n);
  });

  it("cannot restore a pending reserve and does not run another consumer to force it", async () => {
    for (const status of ["RESERVED", "RELEASED"]) {
      const f = fixture();
      f.reservation.status = status;
      await assert.rejects(f.restore(), ConflictException);
      assert.equal(f.operations.size, 0);
      assert.equal(f.reservation.status, status);
    }
  });

  it("caps cumulative partial restores at original spent points", async () => {
    const f = fixture();
    await f.restore();
    f.refund.id = "refund-2";
    f.refund.loyaltyPoints = 15n;
    await f.restore();
    assert.equal(f.wallet.balancePoints, 30n);
    f.refund.id = "refund-3";
    f.refund.loyaltyPoints = 1n;
    await assert.rejects(f.restore(), ConflictException);
    assert.equal(f.operations.size, 2);
    assert.equal(f.wallet.balancePoints, 30n);
  });

  it("rejects changed authoritative identity on a repeated operation", async () => {
    for (const scenario of [
      "points",
      "date",
      "refund-link",
      "reservation-link",
    ]) {
      const f = fixture();
      await f.restore();
      if (scenario === "points") f.refund.loyaltyPoints = 11n;
      if (scenario === "date")
        f.refund.createdAt = new Date("2026-09-21T12:00:00Z");
      if (scenario === "refund-link")
        f.operations.get("refund:refund-1:restore")!.refundId = "other-refund";
      if (scenario === "reservation-link")
        f.reservation.id = "other-reservation";
      await assert.rejects(f.restore(), ConflictException);
      assert.equal(f.wallet.balancePoints, 15n);
    }
  });

  it("requires the original paid checkout actor and refund/reservation sources", async () => {
    for (const scenario of [
      "guest",
      "wrong-owner",
      "pending-payment",
      "missing-paid-at",
      "missing-reservation",
    ]) {
      const f = fixture();
      if (scenario === "guest") f.order.checkoutActorUserId = null;
      if (scenario === "wrong-owner")
        f.order.checkoutActorUserId = "other-user";
      if (scenario === "pending-payment") f.order.paymentStatus = "PENDING";
      if (scenario === "missing-paid-at") f.order.paidAt = null;
      if (scenario === "missing-reservation") f.state.reservationExists = false;
      await assert.rejects(f.restore(), ConflictException);
      assert.equal(f.operations.size, 0);
    }
    const f = fixture();
    f.state.refundExists = false;
    await assert.rejects(f.restore(), NotFoundException);
  });

  it("rejects zero/unsafe source points and balance overflow", async () => {
    for (const points of [0n, -1n, 9007199254740992n]) {
      const f = fixture();
      f.refund.loyaltyPoints = points;
      await assert.rejects(f.restore(), ConflictException);
      assert.equal(f.operations.size, 0);
    }
    const f = fixture();
    f.wallet.balancePoints = BigInt(Number.MAX_SAFE_INTEGER);
    await assert.rejects(f.restore(), ConflictException);
    assert.equal(f.operations.size, 0);
  });
});
