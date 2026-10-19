import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { validate } from "class-validator";

import { UpdateOrderOzonPostingsRequestDTO } from "../src/orders/dto/update-order-ozon-postings-request.dto";
import { OrdersStorage } from "../src/orders/orders.storage";

test("Ozon posting API rejects duplicates, URLs and malformed lists", async () => {
  for (const postingNumbers of [
    null,
    "1-2-3",
    ["1-2-3", "1-2-3"],
    ["https://seller.ozon.ru/app/postings/fbo/1-2-3"],
    ["1-2-3\n"],
    [1],
    Array(51).fill("1-2-3"),
  ]) {
    const dto = Object.assign(new UpdateOrderOzonPostingsRequestDTO(), {
      postingNumbers,
      fbsPostingNumbers: [],
    });
    assert.notEqual((await validate(dto)).length, 0);
  }
  for (const postingNumbers of [
    [],
    ["0121544692-0182-3", "0121544692-0182-4"],
  ]) {
    assert.equal(
      (
        await validate(
          Object.assign(new UpdateOrderOzonPostingsRequestDTO(), {
            postingNumbers,
            fbsPostingNumbers: [],
          }),
        )
      ).length,
      0,
    );
  }
});

function createStorage(provider = "OZON") {
  const order = {
    id: "order-1",
    deliveryProvider: provider,
    ozonPostingNumbers: ["1-2-3"],
    ozonFbsPostingNumbers: [] as string[],
    crmStatus: "DELIVERING",
    paymentStatus: "PAID",
  };
  const histories: unknown[] = [];
  const trackingRequests: Array<{
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }> = [];
  let updates = 0;
  let locks = 0;
  const tx = {
    $executeRaw: async () => {
      locks += 1;
      return 1;
    },
    $queryRaw: async () => {
      locks += 1;
      return [];
    },
    order: {
      findUnique: async () => order,
      findFirst: async () => null,
      findUniqueOrThrow: async () => order,
      update: async ({ data }: { data: { ozonPostingNumbers: string[] } }) => {
        updates += 1;
        Object.assign(order, data);
        return order;
      },
    },
    orderHistory: {
      create: async (input: unknown) => {
        histories.push(input);
      },
    },
    deliveryTrackingRequest: {
      upsert: async (input: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        trackingRequests.push(input);
        return {};
      },
    },
  };
  const storage: OrdersStorage = Object.assign(
    Object.create(OrdersStorage.prototype),
    {
      prisma: {
        user: { findUnique: async () => ({ id: "admin-1" }) },
        $transaction: async <T>(callback: (value: typeof tx) => Promise<T>) =>
          callback(tx),
      },
      mapAdminOrder: (value: unknown) => value,
    },
  );
  return {
    storage,
    order,
    histories,
    trackingRequests,
    counts: () => ({ updates, locks }),
  };
}

test("replacing postings records one history event without changing payment or CRM status", async () => {
  const state = createStorage();
  await state.storage.updateAdminOrderOzonPostings(
    "order-1",
    ["1-2-5", "1-2-4"],
    "admin-1",
    [],
  );
  assert.deepEqual(state.order.ozonPostingNumbers, ["1-2-4", "1-2-5"]);
  assert.equal(state.order.crmStatus, "DELIVERING");
  assert.equal(state.order.paymentStatus, "PAID");
  assert.deepEqual(state.histories, [
    {
      data: {
        orderId: "order-1",
        authorId: "admin-1",
        eventType: "ozon_postings_updated",
        payload: {
          previousPostingNumbers: ["1-2-3"],
          previousFbsPostingNumbers: [],
          fbsPostingNumbers: [],
          postingNumbers: ["1-2-4", "1-2-5"],
        },
      },
    },
  ]);
  await state.storage.updateAdminOrderOzonPostings(
    "order-1",
    ["1-2-5", "1-2-4"],
    "admin-1",
    [],
  );
  assert.equal(state.histories.length, 1);
  assert.deepEqual(state.counts(), { locks: 4, updates: 1 });
  await state.storage.updateAdminOrderOzonPostings(
    "order-1",
    [],
    "admin-1",
    [],
  );
  assert.deepEqual(state.order.ozonPostingNumbers, []);
});

test("Ozon postings cannot be attached to a CDEK order", async () => {
  const state = createStorage("CDEK");
  await assert.rejects(
    state.storage.updateAdminOrderOzonPostings(
      "order-1",
      ["1-2-4"],
      "admin-1",
      [],
    ),
    /provider must be Ozon/,
  );
  assert.equal(state.counts().updates, 0);
  assert.equal(state.histories.length, 0);
});

test("changing only the scheme persists it and republishes the tracking request", async () => {
  const state = createStorage();
  await state.storage.updateAdminOrderOzonPostings(
    "order-1",
    ["1-2-3"],
    "admin-1",
    ["1-2-3"],
  );
  assert.deepEqual(state.order.ozonFbsPostingNumbers, ["1-2-3"]);
  assert.equal(state.histories.length, 1);
  await state.storage.updateAdminOrderOzonPostings(
    "order-1",
    ["1-2-3"],
    "admin-1",
    ["1-2-3"],
  );
  assert.equal(state.histories.length, 1);
  await state.storage.updateAdminOrderOzonPostings(
    "order-1",
    ["1-2-3"],
    "admin-1",
    [],
  );
  assert.deepEqual(state.order.ozonFbsPostingNumbers, []);
  assert.equal(state.histories.length, 2);
  assert.deepEqual(state.trackingRequests[0]?.create.ozonFbsPostingNumbers, [
    "1-2-3",
  ]);
  assert.deepEqual(state.trackingRequests[1]?.create.ozonFbsPostingNumbers, []);
  assert.notEqual(
    state.trackingRequests[0]?.create.revision,
    state.trackingRequests[1]?.create.revision,
  );
});

test("an FBS number outside the full list is rejected without changing the order", async () => {
  const state = createStorage();
  await assert.rejects(
    state.storage.updateAdminOrderOzonPostings(
      "order-1",
      ["1-2-3"],
      "admin-1",
      ["1-2-4"],
    ),
    /FBS postings must be included/,
  );
  assert.equal(state.counts().updates, 0);
});
