import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";
import type { LoyaltyOperation, Prisma } from "../src/generated/prisma/client";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";

function fixture() {
  const member = {
    id: "member-1",
    userId: "user-1",
    status: "ACTIVE",
    historyState: "READY",
  };
  const user = {
    id: "user-1",
    status: "ACTIVE",
    deletedAt: null as Date | null,
  };
  const account = {
    orderId: "order-1",
    memberId: member.id,
    ratePercent: 5,
    rulesVersion: "purchase-v1",
    baseKopecks: 100000n,
    grantedPoints: 250n,
    reversedPoints: 0n,
    refundedKopecks: 0n,
    occurredAt: new Date("2026-09-20T12:00:00Z"),
  };
  const wallet = {
    memberId: member.id,
    balancePoints: 50n,
    reservedPoints: 30n,
    revision: 1n,
  };
  const order = {
    id: account.orderId,
    userId: member.userId,
    checkoutActorUserId: null,
    paymentStatus: "PAID",
    paidAt: new Date("2026-09-20T10:00:00Z"),
    crmStatus: "COMPLETED",
    completedAt: account.occurredAt,
  };
  const refunds = [
    {
      totalKopecks: 50000n,
      deliveryKopecks: 0n,
      createdAt: new Date("2026-09-21T12:00:00Z"),
    },
  ];
  const operations = new Map<string, LoyaltyOperation>();
  const locks: string[] = [];
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      locks.push(strings.join("?"));
      return [];
    },
    loyaltyPurchaseAccount: { findUnique: async () => account },
    loyaltyMember: { findUnique: async () => member },
    loyaltyWallet: {
      findUnique: async () => ({ ...wallet }),
      update: async ({ data }: { data: object }) => Object.assign(wallet, data),
    },
    order: { findUnique: async () => order },
    user: { findUnique: async () => user },
    orderRefund: { findMany: async () => refunds },
    loyaltyOperation: {
      findUnique: async ({ where }: { where: { operationKey: string } }) =>
        operations.get(where.operationKey) ?? null,
      create: async ({ data }: { data: LoyaltyOperation }) => {
        operations.set(data.operationKey, data);
        return data;
      },
    },
  } as unknown as Prisma.TransactionClient;
  const service = new LoyaltyWalletService();
  const credit = () =>
    service.creditPurchaseInTransaction(tx, { orderId: account.orderId });
  const reverse = (points = 125, refundedKopecks = 50000n) =>
    service.reversePurchaseInTransaction(tx, {
      orderId: account.orderId,
      points,
      refundedKopecks,
    });
  return {
    member,
    user,
    account,
    wallet,
    order,
    refunds,
    operations,
    locks,
    tx,
    service,
    credit,
    reverse,
  };
}

describe("purchase wallet source-bound commands", () => {
  it("credits DB account amount to attached buyer, locking order before member", async () => {
    const f = fixture();
    const result = await f.credit();
    assert.equal(result.operation.requestedPoints, 250n);
    assert.equal(result.operation.purchaseOrderId, f.account.orderId);
    assert.equal(result.operation.sourceKey, "purchase:order-1");
    assert.equal(f.wallet.balancePoints, 300n);
    assert.match(f.locks[0]!, /FROM orders/);
    assert.match(f.locks[1]!, /FROM loyalty_members/);
    f.member.status = "BLOCKED";
    assert.equal((await f.credit()).replayed, true);
    assert.equal(f.wallet.balancePoints, 300n);
  });

  it("rejects initial credit for wrong buyer, unpaid, unfinished, blocked or unready members", async () => {
    for (const mutate of [
      (f: ReturnType<typeof fixture>) => {
        f.order.userId = "someone-else";
      },
      (f: ReturnType<typeof fixture>) => {
        f.order.paymentStatus = "PENDING";
      },
      (f: ReturnType<typeof fixture>) => {
        f.order.crmStatus = "DELIVERING";
      },
      (f: ReturnType<typeof fixture>) => {
        f.member.status = "BLOCKED";
      },
      (f: ReturnType<typeof fixture>) => {
        f.member.historyState = "PENDING";
      },
      (f: ReturnType<typeof fixture>) => {
        f.user.status = "BLOCKED";
      },
      (f: ReturnType<typeof fixture>) => {
        f.user.deletedAt = new Date();
      },
    ]) {
      const f = fixture();
      mutate(f);
      await assert.rejects(f.credit(), ConflictException);
      assert.equal(f.operations.size, 0);
    }
  });

  it("cancels only free points, including for blocked members after CRM cancellation", async () => {
    const f = fixture();
    f.member.status = "BLOCKED";
    f.order.crmStatus = "CANCELLED";
    const result = await f.reverse();
    assert.equal(result.operation.requestedPoints, 125n);
    assert.equal(result.operation.balanceDelta, -20n);
    assert.equal(result.operation.reservedDelta, 0n);
    assert.equal(
      result.operation.operationKey,
      "purchase:order-1:reversal:50000",
    );
    assert.equal(result.operation.occurredAt, f.refunds[0]!.createdAt);
    assert.equal(f.wallet.balancePoints, 30n);
    assert.equal(f.wallet.reservedPoints, 30n);
    f.account.reversedPoints = 125n;
    f.account.refundedKopecks = 50000n;
    f.wallet.balancePoints += 1000n;
    f.refunds.unshift({
      totalKopecks: 10000n,
      deliveryKopecks: 0n,
      createdAt: new Date("2026-09-22T12:00:00Z"),
    });
    assert.equal((await f.reverse()).replayed, true);
    assert.equal(f.wallet.balancePoints, 1030n);
  });

  it("records zero-delta forgiveness when all balance is held", async () => {
    const f = fixture();
    f.wallet.balancePoints = f.wallet.reservedPoints;
    assert.equal((await f.reverse()).operation.balanceDelta, 0n);
  });

  it("rejects arbitrary points or refund totals and mismatched replay provenance", async () => {
    const f = fixture();
    await assert.rejects(f.reverse(124), ConflictException);
    await assert.rejects(f.reverse(125, 50001n), ConflictException);
    assert.equal(f.operations.size, 0);
    await f.reverse();
    await assert.rejects(f.reverse(124), ConflictException);
    f.operations.get("purchase:order-1:reversal:50000")!.purchaseOrderId =
      "another-order";
    await assert.rejects(f.reverse(), ConflictException);
  });

  it("never revokes more than initially granted after refunds known before accrual", async () => {
    const f = fixture();
    f.account.grantedPoints = 125n;
    f.account.refundedKopecks = 50000n;
    f.refunds[0]!.totalKopecks = 60000n;
    assert.equal((await f.reverse(25, 60000n)).operation.requestedPoints, 25n);
  });
});
