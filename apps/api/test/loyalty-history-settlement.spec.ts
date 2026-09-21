import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { ConflictException } from "@nestjs/common";

import { Prisma } from "../src/generated/prisma/client";
import type { LoyaltyHistoryPreviewService } from "../src/loyalty/history-preview.service";
import type { PurchaseHistoryEntry } from "../src/loyalty/history-preview";
import { LoyaltyPurchaseHistoryService } from "../src/loyalty/purchase-history.service";
import { LoyaltyPurchaseHistoryWorker } from "../src/loyalty/purchase-history.worker";
import type { LoyaltyPurchaseSettlementService } from "../src/loyalty/purchase-settlement.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const entry = (orderId: string): PurchaseHistoryEntry => ({
  orderId,
  ratePercent: 3,
  rateSource: "historical",
  spendBeforeCheckoutKopecks: "0",
  netRewardPoints: 15,
  proposedCreditPoints: 15,
  accounted: false,
});

function serviceFixture(options: {
  member?: "missing" | "blocked";
  complete?: boolean;
  entries?: PurchaseHistoryEntry[];
  changedOrder?: string;
  claimed?: boolean;
} = {}) {
  let queryCalls = 0;
  const tx = {
    loyaltyMember: {
      findUnique: async (args: { include?: { user?: boolean } }) => {
        if (options.member === "missing") return null;
        if (!args.include)
          return { id: "member-1", userId: "user-1" };
        return {
          id: "member-1",
          userId: "user-1",
          status: options.member === "blocked" ? "BLOCKED" : "ACTIVE",
          historyState: "PENDING",
          user: { status: "ACTIVE", deletedAt: null },
        };
      },
    },
    $queryRaw: async () => {
      queryCalls += 1;
      if (queryCalls === 1)
        return [
          {
            claimed: options.claimed ?? true,
            startedAt: new Date("2026-09-21T00:00:00.000Z"),
          },
        ];
      return [];
    },
    $executeRaw: async () => 1,
  };
  let transactionOptions: unknown;
  let retryWrites = 0;
  const retrySql: string[] = [];
  const prisma = {
    $transaction: async <T>(
      callback: (client: typeof tx) => Promise<T>,
      optionsValue: unknown,
    ) => {
      transactionOptions = optionsValue;
      return callback(tx);
    },
    $executeRaw: async (strings: TemplateStringsArray) => {
      retryWrites += 1;
      retrySql.push(strings.join("?"));
      return 1;
    },
  } as unknown as PrismaService;
  const previewCalls: unknown[] = [];
  const preview = {
    previewMemberInTransaction: async (client: unknown, memberId: string) => {
      previewCalls.push([client, memberId]);
      return {
        memberId,
        complete: options.complete ?? true,
        scope: "purchases",
        rulesVersion: "purchase-history-v1",
        proposedCreditPoints: 30,
        entries: options.entries ?? [entry("order-1"), entry("order-2")],
        issues: options.complete === false ? [{ orderId: "bad", reason: "bad" }] : [],
      };
    },
  } as unknown as LoyaltyHistoryPreviewService;
  const purchaseCalls: Array<{
    tx: unknown;
    orderId: string;
    history: unknown;
  }> = [];
  const purchases = {
    processOrderInTransaction: async (
      client: unknown,
      orderId: string,
      history: unknown,
    ) => {
      purchaseCalls.push({ tx: client, orderId, history });
      return {
        processed: orderId !== options.changedOrder,
        replayed: false,
      };
    },
  } as unknown as LoyaltyPurchaseSettlementService;
  return {
    service: new LoyaltyPurchaseHistoryService(prisma, preview, purchases),
    tx,
    previewCalls,
    purchaseCalls,
    get transactionOptions() {
      return transactionOptions;
    },
    get retryWrites() {
      return retryWrites;
    },
    retrySql,
  };
}

describe("LoyaltyPurchaseHistoryService", () => {
  it("settles every entry in one Serializable transaction and keeps the history context transaction-local", async () => {
    const fixture = serviceFixture();

    const result = await fixture.service.processMember("member-1");

    assert.deepEqual(result, { processed: true, orders: 2 });
    assert.deepEqual(fixture.transactionOptions, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    });
    assert.deepEqual(fixture.previewCalls, [[fixture.tx, "member-1"]]);
    assert.deepEqual(
      fixture.purchaseCalls.map(({ tx, orderId, history }) => ({
        sameTransaction: tx === fixture.tx,
        orderId,
        history,
      })),
      [
        {
          sameTransaction: true,
          orderId: "order-1",
          history: { memberId: "member-1", entry: entry("order-1") },
        },
        {
          sameTransaction: true,
          orderId: "order-2",
          history: { memberId: "member-1", entry: entry("order-2") },
        },
      ],
    );
    assert.equal(fixture.retryWrites, 0);
  });

  it("does not enroll a missing user or authorize a blocked member", async () => {
    for (const member of ["missing", "blocked"] as const) {
      const fixture = serviceFixture({ member });
      assert.deepEqual(await fixture.service.processMember("member-1"), {
        processed: false,
        orders: 0,
      });
      assert.equal(fixture.previewCalls.length, 0);
      assert.equal(fixture.purchaseCalls.length, 0);
      assert.equal(fixture.retryWrites, 0);
    }
  });

  it("returns without reads, writes, or retry state when another worker owns the member claim", async () => {
    const fixture = serviceFixture({ claimed: false });

    assert.deepEqual(await fixture.service.processMember("member-1"), {
      processed: false,
      orders: 0,
    });
    assert.equal(fixture.previewCalls.length, 0);
    assert.equal(fixture.purchaseCalls.length, 0);
    assert.equal(fixture.retryWrites, 0);
  });

  it("rejects an incomplete preview before the first order and stores only a sanitized retry reason", async () => {
    const fixture = serviceFixture({ complete: false });

    await assert.rejects(
      fixture.service.processMember("member-1"),
      ConflictException,
    );

    assert.equal(fixture.purchaseCalls.length, 0);
    assert.equal(fixture.retryWrites, 1);
    assert.match(
      fixture.retrySql[0]!,
      /purchase_history_processing_failed/,
    );
    assert.match(
      fixture.retrySql[0]!,
      /completed_at IS NULL[\s\S]*completed_at < \?/,
    );
    assert.doesNotMatch(fixture.retrySql[0]!, /bad|issues/i);
  });

  it("aborts the whole member when any source changes during settlement", async () => {
    const fixture = serviceFixture({ changedOrder: "order-2" });

    await assert.rejects(
      fixture.service.processMember("member-1"),
      /source changed during settlement/,
    );

    assert.deepEqual(
      fixture.purchaseCalls.map((call) => call.orderId),
      ["order-1", "order-2"],
    );
    assert.equal(fixture.retryWrites, 1);
  });

  it("validates batch bounds and continues after one member fails", async () => {
    const fixture = serviceFixture();
    (
      fixture.service as unknown as {
        prisma: { $queryRaw: () => Promise<Array<{ id: string }>> };
      }
    ).prisma.$queryRaw = async () => [{ id: "bad" }, { id: "good" }];
    const calls: string[] = [];
    fixture.service.processMember = async (memberId) => {
      calls.push(memberId);
      if (memberId === "bad") throw new Error("PRIVATE member failure");
      return { processed: true, orders: 1 };
    };
    const warnings: string[] = [];
    (
      fixture.service as unknown as {
        logger: { warn: (message: string) => void };
      }
    ).logger = { warn: (message) => warnings.push(message) };

    assert.equal(await fixture.service.processDueMembers(2), 1);
    assert.deepEqual(calls, ["bad", "good"]);
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(warnings[0]!, /PRIVATE|member failure/);
    for (const limit of [0, -1, 1.5, 51])
      await assert.rejects(fixture.service.processDueMembers(limit));
  });

  it("depends only on database facts and the internal preview/purchase contracts", () => {
    const source = readFileSync(
      `${__dirname}/../src/loyalty/purchase-history.service.ts`,
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /from ["'][^"']*(?:tbank|ozon|orders\.service|orders\.storage)/i,
    );
    assert.doesNotMatch(source, /fetch\(|axios|manualRetry|historyState:\s*["']READY/);
    assert.match(source, /previewMemberInTransaction/);
    assert.match(source, /processOrderInTransaction/);
    assert.match(source, /TransactionIsolationLevel\.Serializable/);
  });
});

describe("LoyaltyPurchaseHistoryWorker", () => {
  it("starts with a DB poll and an unref 15-second timer, then stops completely", async () => {
    let polls = 0;
    const worker = new LoyaltyPurchaseHistoryWorker({
      processDueMembers: async () => {
        polls += 1;
        return 0;
      },
    } as LoyaltyPurchaseHistoryService);
    const state = worker as unknown as { timer?: NodeJS.Timeout };
    try {
      worker.onModuleInit();
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(polls, 1);
      assert.ok(state.timer);
      assert.equal(state.timer.hasRef(), false);
      assert.equal(
        (state.timer as NodeJS.Timeout & { _idleTimeout: number })
          ._idleTimeout,
        15_000,
      );
    } finally {
      worker.onModuleDestroy();
    }
    assert.equal(state.timer, undefined);
    await worker.poll();
    assert.equal(polls, 1);
  });

  it("does not overlap polls and releases the latch after a sanitized failure", async () => {
    let finish: (() => void) | undefined;
    let polls = 0;
    const warnings: string[] = [];
    const worker = new LoyaltyPurchaseHistoryWorker({
      processDueMembers: async () => {
        polls += 1;
        if (polls === 1) {
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
          throw new Error("PRIVATE historical source failure");
        }
        return 0;
      },
    } as LoyaltyPurchaseHistoryService);
    (
      worker as unknown as { logger: { warn: (message: string) => void } }
    ).logger = { warn: (message) => warnings.push(message) };

    const active = worker.poll();
    await worker.poll();
    assert.equal(polls, 1);
    finish!();
    await active;
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(warnings[0]!, /PRIVATE|historical source failure/);
    await worker.poll();
    assert.equal(polls, 2);
    worker.onModuleDestroy();
  });
});
