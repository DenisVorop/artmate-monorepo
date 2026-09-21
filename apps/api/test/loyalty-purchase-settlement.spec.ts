import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { LoyaltyPurchaseSettlementWorker } from "../src/loyalty/purchase-settlement.worker";
import type { LoyaltyPurchaseSettlementService } from "../src/loyalty/purchase-settlement.service";

describe("LoyaltyPurchaseSettlementWorker", () => {
  it("starts with a DB poll and an unref timer, then stops completely on destroy", async () => {
    let polls = 0;
    const worker = new LoyaltyPurchaseSettlementWorker({
      processDueOrders: async () => {
        polls += 1;
        return 0;
      },
    } as LoyaltyPurchaseSettlementService);
    const state = worker as unknown as { timer?: NodeJS.Timeout };
    try {
      worker.onModuleInit();
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(polls, 1);
      assert.ok(state.timer);
      assert.equal(state.timer.hasRef(), false);
    } finally {
      worker.onModuleDestroy();
    }
    assert.equal(state.timer, undefined);
    await worker.poll();
    assert.equal(polls, 1);
  });

  it("does not overlap polls and recovers the latch after a sanitized failure", async () => {
    let finish: (() => void) | undefined;
    let polls = 0;
    const warnings: string[] = [];
    const worker = new LoyaltyPurchaseSettlementWorker({
      processDueOrders: async () => {
        polls += 1;
        if (polls === 1) {
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
          throw new Error("PRIVATE provider-independent wallet failure");
        }
        return 0;
      },
    } as LoyaltyPurchaseSettlementService);
    (
      worker as unknown as { logger: { warn: (value: string) => void } }
    ).logger = { warn: (value) => warnings.push(value) };
    const active = worker.poll();
    await worker.poll();
    assert.equal(polls, 1);
    finish!();
    await active;
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(warnings[0]!, /PRIVATE|wallet failure/);
    await worker.poll();
    assert.equal(polls, 2);
    worker.onModuleDestroy();
  });

  it("keeps purchase settlement independent of payment adapters and manual controls", () => {
    const source = readFileSync(
      `${__dirname}/../src/loyalty/purchase-settlement.service.ts`,
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /from ["'][^"']*(?:tbank|ozon|orders\.service|orders\.storage)/i,
    );
    assert.doesNotMatch(
      source,
      /fetch\(|axios|reconcilePayment|confirmPayment|manualRetry/,
    );
    assert.match(source, /readOrderPricing/);
    assert.match(source, /loyaltyPurchaseAccount/);
    assert.match(source, /loyaltyPurchaseSync/);
  });
});
