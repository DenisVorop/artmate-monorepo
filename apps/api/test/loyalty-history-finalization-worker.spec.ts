import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LoyaltyHistoryFinalizationService } from "../src/loyalty/history-finalization.service";
import { LoyaltyHistoryFinalizationWorker } from "../src/loyalty/history-finalization.worker";
import type { LoyaltyHistoryPreviewService } from "../src/loyalty/history-preview.service";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("automatic loyalty-history finalization", () => {
  it("polls immediately, unreferences its timer and stops cleanly", async () => {
    let polls = 0;
    const worker = new LoyaltyHistoryFinalizationWorker({
      processDueMembers: async () => ++polls,
    } as LoyaltyHistoryFinalizationService);
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

  it("does not overlap polls and retries after a sanitized failure", async () => {
    let release!: () => void;
    let polls = 0;
    const warnings: string[] = [];
    const worker = new LoyaltyHistoryFinalizationWorker({
      processDueMembers: async () => {
        if (++polls === 1) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          throw new Error("PRIVATE finalization database details");
        }
        return 0;
      },
    } as LoyaltyHistoryFinalizationService);
    (worker as unknown as { logger: { warn: (message: string) => void } }).logger = {
      warn: (message) => warnings.push(message),
    };

    const active = worker.poll();
    await worker.poll();
    assert.equal(polls, 1);
    release();
    await active;
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(warnings[0]!, /PRIVATE|database details/);

    await worker.poll();
    assert.equal(polls, 2);
    worker.onModuleDestroy();
  });

  it("counts only members that were processed into READY and continues after failure", async () => {
    const service = new LoyaltyHistoryFinalizationService(
      {
        $queryRaw: async () => [
          { id: "failed" },
          { id: "waiting" },
          { id: "ready" },
          { id: "replayed" },
        ],
      } as unknown as PrismaService,
      {} as LoyaltyHistoryPreviewService,
    );
    const seen: string[] = [];
    service.processMember = async (memberId) => {
      seen.push(memberId);
      if (memberId === "failed") throw new Error("retry");
      if (memberId === "waiting") return { processed: true, ready: false };
      if (memberId === "replayed") return { processed: false, ready: true };
      return { processed: true, ready: true };
    };
    (service as unknown as { logger: { warn: () => void } }).logger = {
      warn: () => undefined,
    };

    assert.equal(await service.processDueMembers(4), 1);
    assert.deepEqual(seen, ["failed", "waiting", "ready", "replayed"]);
  });

  it("rejects invalid due-member batch sizes without reading storage", async () => {
    const service = new LoyaltyHistoryFinalizationService(
      {} as PrismaService,
      {} as LoyaltyHistoryPreviewService,
    );

    for (const limit of [0, -1, 1.5, NaN, Infinity, 51])
      await assert.rejects(service.processDueMembers(limit), /batch size/);
  });
});
