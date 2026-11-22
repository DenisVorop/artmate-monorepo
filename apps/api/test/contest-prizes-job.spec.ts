import "reflect-metadata";
import assert from "node:assert/strict";
import { it, mock } from "node:test";
import { Logger } from "@nestjs/common";
import { ContestPrizesJob } from "../src/cron/jobs/contest-prizes.job";
import type { OrderPrizesService } from "../src/orders/prizes/prizes.service";
import type { ContestPromoPrizesService } from "../src/promocodes/contest-promo-prizes.service";

it("keeps promo issuance independent of a product consumer failure and retries the next pass", async () => {
  const log = mock.method(Logger.prototype, "error", () => undefined);
  let productCalls = 0;
  let promoCalls = 0;
  const job = new ContestPrizesJob(
    {
      issueAwards: async () => {
        if (++productCalls === 1) throw new Error("temporary outage");
        return 1;
      },
    } as unknown as OrderPrizesService,
    {
      issueAwards: async () => {
        promoCalls++;
        return 1;
      },
    } as unknown as ContestPromoPrizesService,
  );
  try {
    await job.run();
    assert.equal(promoCalls, 1);
    assert.equal(log.mock.callCount(), 1);
    await job.run();
    assert.equal(productCalls, 2);
    assert.equal(promoCalls, 2);
  } finally {
    log.mock.restore();
  }
});
