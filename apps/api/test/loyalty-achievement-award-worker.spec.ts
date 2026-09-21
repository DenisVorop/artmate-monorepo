import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LoyaltyAchievementAwardWorker } from "../src/loyalty/achievement-award.worker";
import { LoyaltyAchievementAwardService } from "../src/loyalty/achievement-award.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { LoyaltyWalletService } from "../src/loyalty/wallet.service";

describe("automatic achievement polling", () => {
  it("starts immediately and releases the timer on shutdown", async () => {
    let polls = 0;
    const worker = new LoyaltyAchievementAwardWorker({
      processDueMembers: async () => ++polls,
    } as LoyaltyAchievementAwardService);
    const state = worker as unknown as { timer?: NodeJS.Timeout };
    try {
      worker.onModuleInit();
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(polls, 1);
      assert.equal(state.timer?.hasRef(), false);
    } finally {
      worker.onModuleDestroy();
    }
    assert.equal(state.timer, undefined);
    await worker.poll();
    assert.equal(polls, 1);
  });

  it("does not overlap polls and automatically retries a failed pass", async () => {
    let finish!: () => void;
    let polls = 0;
    const warnings: string[] = [];
    const worker = new LoyaltyAchievementAwardWorker({
      processDueMembers: async () => {
        if (++polls === 1) {
          await new Promise<void>((resolve) => { finish = resolve; });
          throw new Error("PRIVATE connection information");
        }
        return 0;
      },
    } as LoyaltyAchievementAwardService);
    (worker as unknown as { logger: { warn: (message: string) => void } }).logger = {
      warn: (message) => warnings.push(message),
    };
    const pending = worker.poll();
    await worker.poll();
    assert.equal(polls, 1);
    finish();
    await pending;
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(warnings[0]!, /PRIVATE|connection information/);
    await worker.poll();
    assert.equal(polls, 2);
    worker.onModuleDestroy();
  });

  it("a failed member does not stop other eligible members", async () => {
    const service = new LoyaltyAchievementAwardService({
      $queryRaw: async () => [{ id: "failed" }, { id: "eligible" }],
    } as unknown as PrismaService, {} as LoyaltyWalletService);
    const seen: string[] = [];
    service.processMember = async (id) => {
      seen.push(id);
      if (id === "failed") throw new Error("retry");
      return { processed: true, awards: 1 };
    };
    (service as unknown as { logger: { warn: () => void } }).logger = {
      warn: () => undefined,
    };
    assert.equal(await service.processDueMembers(), 1);
    assert.deepEqual(seen, ["failed", "eligible"]);
  });

  it("rejects invalid batch bounds before touching storage", async () => {
    const service = new LoyaltyAchievementAwardService({} as PrismaService, {} as LoyaltyWalletService);
    for (const limit of [0, -1, 1.5, NaN, Infinity, 101]) {
      await assert.rejects(service.processMember("member", limit), /batch size/);
      await assert.rejects(service.processDueMembers(limit), /batch size/);
    }
    await assert.rejects(service.processDueMembers(51), /batch size/);
  });
});
