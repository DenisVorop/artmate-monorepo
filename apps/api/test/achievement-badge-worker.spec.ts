import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AchievementBadgeWorker } from "../src/achievements/badge.worker";
import { AchievementBadgeService } from "../src/achievements/badge.service";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("automatic independent badge polling", () => {
  it("starts immediately and releases the timer on shutdown", async () => {
    let polls = 0;
    const worker = new AchievementBadgeWorker({
      processDueUsers: async () => ++polls,
    } as AchievementBadgeService);
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
    const worker = new AchievementBadgeWorker({
      processDueUsers: async () => {
        if (++polls === 1) {
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
          throw new Error("PRIVATE connection information");
        }
        return 0;
      },
    } as AchievementBadgeService);
    (
      worker as unknown as { logger: { warn: (message: string) => void } }
    ).logger = {
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

  it("a failed user does not stop other eligible users", async () => {
    const service = new AchievementBadgeService({
      $queryRaw: async () => [{ id: "failed" }, { id: "eligible" }],
    } as unknown as PrismaService);
    const seen: string[] = [];
    service.processUser = async (id) => {
      seen.push(id);
      if (id === "failed") throw new Error("retry");
      return { processed: true, badges: 1 };
    };
    (service as unknown as { logger: { warn: () => void } }).logger = {
      warn: () => undefined,
    };
    assert.equal(await service.processDueUsers(), 1);
    assert.deepEqual(seen, ["failed", "eligible"]);
  });

  it("rejects invalid batch bounds before touching storage", async () => {
    const service = new AchievementBadgeService({} as PrismaService);
    for (const limit of [0, -1, 1.5, NaN, Infinity, 101]) {
      await assert.rejects(service.processUser("user", limit), /batch size/);
      await assert.rejects(service.processDueUsers(limit), /batch size/);
    }
    await assert.rejects(service.processDueUsers(51), /batch size/);
  });
});
