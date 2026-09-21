import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LoyaltyWorkRewardWorker } from "../src/loyalty/work-reward.worker";
import { LoyaltyWorkRewardService } from "../src/loyalty/work-reward.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { LoyaltyWalletService } from "../src/loyalty/wallet.service";

describe("LoyaltyWorkRewardWorker", () => {
  it("polls on startup and cleans up its unref timer on shutdown", async () => {
    let polls = 0;
    const worker = new LoyaltyWorkRewardWorker({
      processDueMembers: async () => ++polls,
    } as LoyaltyWorkRewardService);
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

  it("prevents overlapping polls and retries after failure without leaking error details", async () => {
    let finish!: () => void;
    let polls = 0;
    const warnings: string[] = [];
    const worker = new LoyaltyWorkRewardWorker({
      processDueMembers: async () => {
        if (++polls === 1) {
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
          throw new Error("PRIVATE database details");
        }
        return 0;
      },
    } as LoyaltyWorkRewardService);
    (worker as unknown as { logger: { warn: (s: string) => void } }).logger = {
      warn: (message) => warnings.push(message),
    };
    const active = worker.poll();
    await worker.poll();
    assert.equal(polls, 1);
    finish();
    await active;
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(warnings[0]!, /PRIVATE|database details/);
    await worker.poll();
    assert.equal(polls, 2);
    worker.onModuleDestroy();
  });
});

describe("LoyaltyWorkRewardService batch", () => {
  it("continues processing other members after a failed member", async () => {
    const service = new LoyaltyWorkRewardService(
      {
        $queryRaw: async () => [{ id: "bad" }, { id: "good" }],
      } as unknown as PrismaService,
      {} as LoyaltyWalletService,
    );
    const seen: string[] = [];
    service.processMember = async (memberId) => {
      seen.push(memberId);
      if (memberId === "bad") throw new Error("retry me");
      return { processed: true, rewards: 1 };
    };
    (service as unknown as { logger: { warn: () => void } }).logger = {
      warn: () => undefined,
    };
    assert.equal(await service.processDueMembers(), 1);
    assert.deepEqual(seen, ["bad", "good"]);
  });

  it("rejects invalid batch sizes before accessing the database", async () => {
    const service = new LoyaltyWorkRewardService(
      {} as PrismaService,
      {} as LoyaltyWalletService,
    );
    for (const limit of [0, -1, 1.5, NaN, Infinity, 101]) {
      await assert.rejects(
        service.processMember("member", limit),
        /batch size/,
      );
      await assert.rejects(service.processDueMembers(limit), /batch size/);
    }
    await assert.rejects(service.processDueMembers(51), /batch size/);
  });
});
