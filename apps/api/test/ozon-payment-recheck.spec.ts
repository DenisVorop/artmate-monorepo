import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OrdersService } from "../src/orders/orders.service";
import type { OrdersStorage } from "../src/orders/orders.storage";
import {
  ozonPaymentRecheckDelayMs,
  ozonPaymentRecheckLeaseMs,
  ozonPaymentRecheckMaxAttempts,
  type OzonPaymentRecheckLease,
} from "../src/orders/ozon-payment-recheck";
import { OzonPaymentRecheckService } from "../src/orders/ozon-payment-recheck.service";

describe("Ozon payment recheck worker", () => {
  it("uses a bounded backoff, attempt budget and finite lease", () => {
    assert.deepEqual(
      [0, 1, 2, 3, 4, 5].map(ozonPaymentRecheckDelayMs),
      [5_000, 15_000, 30_000, 60_000, 120_000, 300_000],
    );
    assert.equal(ozonPaymentRecheckDelayMs(100), 300_000);
    assert.equal(ozonPaymentRecheckMaxAttempts, 12);
    assert.equal(ozonPaymentRecheckLeaseMs, 60_000);
  });

  it("claims one job at a time and limits each run to five", async () => {
    let claimed = 0;
    let completed = 0;
    const fixture = createWorker(
      async () => {
        assert.equal(
          claimed,
          completed,
          "Do not lease jobs ahead of execution",
        );
        claimed += 1;
        return lease(claimed);
      },
      async (job) => {
        completed += 1;
        assert.equal(job.orderId, `order-${completed}`);
      },
    );

    await fixture.worker.processDueRechecks();

    assert.equal(claimed, 5);
    assert.equal(completed, 5);
    assert.deepEqual(fixture.failures, []);
  });

  it("does not overlap processing runs on the same worker", async () => {
    let release: () => void = () => undefined;
    let started: () => void = () => undefined;
    const processing = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    let claims = 0;
    let calls = 0;
    const fixture = createWorker(
      async () => (++claims === 1 ? lease(1) : undefined),
      async () => {
        calls += 1;
        started();
        await processing;
      },
    );

    const first = fixture.worker.processDueRechecks();
    try {
      await entered;
      await fixture.worker.processDueRechecks();
      assert.equal(claims, 1);
      assert.equal(calls, 1);
    } finally {
      release();
      await first;
    }
  });

  it("records only a safe failure code and continues to the next claimed order", async () => {
    let claims = 0;
    const completed: string[] = [];
    const fixture = createWorker(
      async () => (++claims <= 2 ? lease(claims) : undefined),
      async (job) => {
        if (job.orderId === "order-1") {
          throw new Error("PRIVATE_TOKEN_AND_CUSTOMER_DETAILS");
        }
        completed.push(job.orderId);
      },
    );
    const logs: unknown[] = [];
    Object.assign(fixture.worker, {
      logger: { warn: (message: unknown) => logs.push(message) },
    });

    await fixture.worker.processDueRechecks();

    assert.deepEqual(fixture.failures, [
      { job: lease(1), errorCode: "status_check_failed" },
    ]);
    assert.deepEqual(completed, ["order-2"]);
    assert.doesNotMatch(
      JSON.stringify(logs),
      /PRIVATE_TOKEN_AND_CUSTOMER_DETAILS/,
    );
  });

  it("does no bank work when there are no enrolled due jobs", async () => {
    const fixture = createWorker(
      async () => undefined,
      async () => {
        assert.fail(
          "A pending order without a durable job must not be scanned",
        );
      },
    );
    await fixture.worker.processDueRechecks();
    assert.deepEqual(fixture.failures, []);
  });
});

function lease(id: number): OzonPaymentRecheckLease {
  return { orderId: `order-${id}`, leaseToken: `lease-${id}` };
}

function createWorker(
  claim: () => Promise<OzonPaymentRecheckLease | undefined>,
  recheck: (job: OzonPaymentRecheckLease) => Promise<void>,
) {
  const failures: Array<{ job: OzonPaymentRecheckLease; errorCode: string }> =
    [];
  const storage = {
    claimOzonPaymentRecheck: claim,
    failOzonPaymentRecheck: async (
      job: OzonPaymentRecheckLease,
      errorCode: string,
    ) => {
      failures.push({ job, errorCode });
    },
  } as unknown as OrdersStorage;
  const service = {
    recheckOzonPaymentNotification: recheck,
  } as unknown as OrdersService;
  return {
    worker: new OzonPaymentRecheckService(storage, service),
    failures,
  };
}
