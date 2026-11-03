import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { Logger } from "@nestjs/common";

import { DeliveryTrackingService } from "../src/delivery-tracking/delivery-tracking.service";
import {
  OzonPostingClient,
  OzonPostingError,
  type OzonPostingState,
} from "../src/delivery-tracking/ozon-posting.client";
import {
  TrackingStorage,
  type PostingState,
  type TrackingLease,
} from "../src/delivery-tracking/tracking.storage";

function lease(orderId: string, externalNumbers = ["1-2-3"]): TrackingLease {
  return {
    orderId,
    revision: `revision-${orderId}`,
    ozonPostings: externalNumbers.map((number) => ({ number, scheme: "fbo" })),
    leaseToken: `token-${orderId}`,
  };
}

function harness(
  leases: TrackingLease[],
  getState: (number: string) => Promise<OzonPostingState> = async () =>
    "delivered",
  configured = true,
) {
  let claims = 0;
  const requests: string[] = [];
  const settlements: Array<{
    lease: TrackingLease;
    states: PostingState[] | null;
  }> = [];
  const storage: TrackingStorage = Object.assign(
    Object.create(TrackingStorage.prototype),
    {
      claimNext: async () => leases[claims++] ?? null,
      settle: async (claimed: TrackingLease, states: PostingState[] | null) => {
        settlements.push({ lease: claimed, states });
        return true;
      },
    },
  );
  const ozon: OzonPostingClient = Object.assign(
    Object.create(OzonPostingClient.prototype),
    {
      isConfigured: () => configured,
      getState: async (number: string) => {
        requests.push(number);
        return getState(number);
      },
    },
  );
  return {
    service: new DeliveryTrackingService(storage, ozon),
    requests,
    settlements,
    claims: () => claims,
  };
}

test("unconfigured tracking does not claim orders or call the provider", async () => {
  const state = harness([lease("order-1")], undefined, false);

  await state.service.synchronize();

  assert.equal(state.claims(), 0);
  assert.deepEqual(state.requests, []);
  assert.deepEqual(state.settlements, []);
});

test("no due orders stop the batch without requesting posting states", async () => {
  const state = harness([]);

  await state.service.synchronize();

  assert.equal(state.claims(), 1);
  assert.deepEqual(state.requests, []);
  assert.deepEqual(state.settlements, []);
});

test("a complete posting batch is settled with its normalized states", async () => {
  const expected: PostingState[] = [
    { externalNumber: "1-2-3", state: "delivered" },
    { externalNumber: "1-2-4", state: "pending" },
    { externalNumber: "1-2-5", state: "in_transit" },
    { externalNumber: "1-2-6", state: "cancelled" },
    { externalNumber: "1-2-7", state: "unknown" },
  ];
  const claimed = lease(
    "order-1",
    expected.map((entry) => entry.externalNumber),
  );
  const state = harness([claimed], async (number) => {
    const entry = expected.find((item) => item.externalNumber === number);
    assert.ok(entry);
    return entry.state;
  });

  await state.service.synchronize();

  assert.deepEqual(
    state.requests,
    claimed.ozonPostings.map((posting) => posting.number),
  );
  assert.deepEqual(state.settlements, [{ lease: claimed, states: expected }]);
  assert.equal(state.claims(), 2);
});

test("one failed posting discards a partial batch and settles a retry", async (t) => {
  t.mock.method(Logger.prototype, "warn", () => undefined);
  const claimed = lease("order-1", ["1-2-3", "1-2-4", "1-2-5"]);
  const state = harness([claimed], async (number) => {
    if (number === "1-2-4") throw new Error("Provider request failed");
    return "delivered";
  });

  await state.service.synchronize();

  assert.deepEqual(state.requests, ["1-2-3", "1-2-4"]);
  assert.deepEqual(state.settlements, [{ lease: claimed, states: null }]);
});

test("a provider failure does not prevent checking the next claimed order", async (t) => {
  t.mock.method(Logger.prototype, "warn", () => undefined);
  const failed = lease("order-1", ["1-2-3"]);
  const succeeded = lease("order-2", ["4-5-6"]);
  const state = harness([failed, succeeded], async (number) => {
    if (number === "1-2-3") throw new Error("Provider request failed");
    return "delivered";
  });

  await state.service.synchronize();

  assert.deepEqual(state.requests, ["1-2-3", "4-5-6"]);
  assert.deepEqual(state.settlements, [
    { lease: failed, states: null },
    {
      lease: succeeded,
      states: [{ externalNumber: "4-5-6", state: "delivered" }],
    },
  ]);
  assert.equal(state.claims(), 3);
});

test("one synchronization run claims no more than twenty orders", async () => {
  const leases = Array.from({ length: 21 }, (_, index) =>
    lease(`order-${index}`, [`1-2-${index}`]),
  );
  const state = harness(leases);

  await state.service.synchronize();

  assert.equal(state.claims(), 20);
  assert.equal(state.settlements.length, 20);
  assert.deepEqual(
    state.requests,
    leases
      .slice(0, 20)
      .flatMap((entry) => entry.ozonPostings.map((posting) => posting.number)),
  );
});

test("a mixed order checks each posting using its saved scheme", async () => {
  const claimed = lease("mixed", ["1-2-3", "1-2-4"]);
  claimed.ozonPostings[1]!.scheme = "fbs";
  const requests: unknown[] = [];
  const ozon = {
    isConfigured: () => true,
    getState: async (...args: unknown[]) => {
      requests.push(args);
      return "delivered";
    },
  };
  let next: TrackingLease | null = claimed;
  const storage = {
    claimNext: async () => {
      const result = next;
      next = null;
      return result;
    },
    settle: async () => true,
  };
  await new DeliveryTrackingService(
    storage as unknown as TrackingStorage,
    ozon as unknown as OzonPostingClient,
  ).synchronize();
  assert.deepEqual(requests, [
    ["1-2-3", "fbo"],
    ["1-2-4", "fbs"],
  ]);
});

test("access errors reach the persisted observation as a sanitized failure reason", async (t) => {
  t.mock.method(Logger.prototype, "warn", () => undefined);
  let next: TrackingLease | null = lease("denied");
  const settled: unknown[][] = [];
  const storage = {
    claimNext: async () => {
      const result = next;
      next = null;
      return result;
    },
    settle: async (...args: unknown[]) => {
      settled.push(args);
      return true;
    },
  };
  const ozon = {
    isConfigured: () => true,
    getState: async () => {
      throw new OzonPostingError("access_denied");
    },
  };
  await new DeliveryTrackingService(
    storage as unknown as TrackingStorage,
    ozon as unknown as OzonPostingClient,
  ).synchronize();
  assert.equal(settled.length, 1);
  assert.equal(settled[0]![1], null);
  assert.equal(settled[0]![2], "access_denied");
});
