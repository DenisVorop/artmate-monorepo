import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";
import type { LoyaltyOperation, Prisma } from "../src/generated/prisma/client";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";

function fixture() {
  const member = {
    id: "member",
    userId: "user",
    status: "ACTIVE",
    historyState: "PENDING",
  };
  const user = { status: "ACTIVE", deletedAt: null as Date | null };
  const account = {
    orderId: "order",
    memberId: member.id,
    grantedPoints: 150n,
    rulesVersion: "purchase-v1",
    occurredAt: new Date("2026-09-06T00:00:00Z"),
  };
  const wallet = {
    memberId: member.id,
    balancePoints: 0n,
    reservedPoints: 0n,
    revision: 0n,
  };
  const authorization = { allowed: false, checks: 0 };
  const operations = new Map<string, LoyaltyOperation>();
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes("active_transaction_id")) {
        assert.match(sql, /active_transaction_id = txid_current\(\)/);
        assert.deepEqual(values, [member.id]);
        authorization.checks++;
        return [{ authorized: authorization.allowed }];
      }
      return [];
    },
    loyaltyPurchaseAccount: { findUnique: async () => account },
    loyaltyMember: { findUnique: async () => member },
    loyaltyWallet: {
      findUnique: async () => ({ ...wallet }),
      update: async ({ data }: { data: object }) => Object.assign(wallet, data),
    },
    order: {
      findUnique: async () => ({
        userId: member.userId,
        paymentStatus: "PAID",
        paidAt: account.occurredAt,
        crmStatus: "COMPLETED",
        completedAt: account.occurredAt,
      }),
    },
    user: { findUnique: async () => user },
    loyaltyOperation: {
      findUnique: async ({ where }: { where: { operationKey: string } }) =>
        operations.get(where.operationKey) ?? null,
      create: async ({ data }: { data: LoyaltyOperation }) => {
        operations.set(data.operationKey, data);
        return data;
      },
    },
  } as unknown as Prisma.TransactionClient;
  const credit = () =>
    new LoyaltyWalletService().creditPurchaseInTransaction(tx, {
      orderId: account.orderId,
    });
  return { member, user, wallet, authorization, operations, credit };
}

describe("historical purchase wallet authorization", () => {
  it("requires the same active history transaction for PENDING credits and retains replay identity", async () => {
    const f = fixture();
    await assert.rejects(f.credit(), ConflictException);
    assert.equal(f.operations.size, 0);
    f.authorization.allowed = true;
    const result = await f.credit();
    assert.equal(result.operation.operationKey, "purchase:order:credit");
    assert.equal(result.operation.rulesVersion, "purchase-v1");
    assert.equal(f.wallet.balancePoints, 150n);
    assert.equal(f.member.historyState, "PENDING");
    f.authorization.allowed = false;
    f.member.status = "BLOCKED";
    assert.equal((await f.credit()).replayed, true);
    assert.equal(f.authorization.checks, 2);
    assert.equal(f.wallet.balancePoints, 150n);
  });

  it("does not query history context for READY and cannot authorize FAILED, blocked or inactive users", async () => {
    const ready = fixture();
    ready.member.historyState = "READY";
    await ready.credit();
    assert.equal(ready.authorization.checks, 0);
    for (const mutate of [
      (f: ReturnType<typeof fixture>) => {
        f.member.historyState = "FAILED";
      },
      (f: ReturnType<typeof fixture>) => {
        f.member.status = "BLOCKED";
      },
      (f: ReturnType<typeof fixture>) => {
        f.user.status = "BLOCKED";
      },
      (f: ReturnType<typeof fixture>) => {
        f.user.deletedAt = new Date();
      },
    ]) {
      const f = fixture();
      f.authorization.allowed = true;
      mutate(f);
      await assert.rejects(f.credit(), ConflictException);
      assert.equal(f.operations.size, 0);
    }
  });
});
