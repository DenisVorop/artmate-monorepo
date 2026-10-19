import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateOrderOzonPostingsRequestDTO } from "../src/orders/dto/update-order-ozon-postings-request.dto";
import {
  OzonPostings,
  type OzonPosting,
} from "../src/delivery-tracking/ozon-postings";
import { OrdersStorage } from "../src/orders/orders.storage";

test("Ozon posting API validates each number and scheme and rejects duplicate numbers", async () => {
  for (const ozonPostings of [
    null,
    "1-2-3",
    ["1-2-3"],
    [1],
    [null],
    [{}],
    [{ number: "1-2-3" }],
    [{ scheme: "fbo" }],
    [{ number: "1-2-3", scheme: "rfbs" }],
    [{ number: "1-2-3\n", scheme: "fbs" }],
    [
      {
        number: "https://seller.ozon.ru/app/postings/fbo/1-2-3",
        scheme: "fbo",
      },
    ],
    [
      { number: "1-2-3", scheme: "fbo" },
      { number: "1-2-3", scheme: "fbs" },
    ],
    Array.from({ length: 51 }, (_, index) => ({
      number: `1-2-${index}`,
      scheme: "fbo",
    })),
  ]) {
    const dto = plainToInstance(UpdateOrderOzonPostingsRequestDTO, {
      ozonPostings,
    });
    assert.notEqual(
      (await validate(dto)).length,
      0,
      JSON.stringify(ozonPostings),
    );
  }
  for (const ozonPostings of [
    [],
    [
      { number: "0121544692-0182-3", scheme: "fbo" },
      { number: "0121544692-0182-4", scheme: "fbs" },
    ],
  ]) {
    assert.equal(
      (
        await validate(
          plainToInstance(UpdateOrderOzonPostingsRequestDTO, { ozonPostings }),
        )
      ).length,
      0,
    );
  }
});

test("persisted posting data is validated before it can drive tracking or completion", () => {
  for (const invalid of [
    null,
    {},
    ["1-2-3"],
    [{ number: "1-2-3", scheme: "rfbs" }],
    [{ number: "1-2-3\n", scheme: "fbo" }],
    [
      { number: "1-2-3", scheme: "fbo" },
      { number: "1-2-3", scheme: "fbs" },
    ],
  ]) {
    assert.throws(() => OzonPostings.parse(invalid), /Invalid Ozon postings/);
  }
  assert.deepEqual(OzonPostings.parse([{ scheme: "fbs", number: "012-3-4" }]), [
    { number: "012-3-4", scheme: "fbs" },
  ]);
});

function createStorage(provider = "OZON", conflictingOrder = false) {
  const order = {
    id: "order-1",
    deliveryProvider: provider,
    ozonPostings: [{ number: "1-2-3", scheme: "fbo" }] as OzonPosting[],
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
      findFirst: async () => (conflictingOrder ? { id: "other" } : null),
      findUniqueOrThrow: async () => order,
      update: async ({ data }: { data: { ozonPostings: OzonPosting[] } }) => {
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

test("replacing a mixed posting list records history and publishes the complete typed list", async () => {
  const state = createStorage();
  const postings: OzonPosting[] = [
    { number: "1-2-5", scheme: "fbs" },
    { number: "1-2-4", scheme: "fbo" },
  ];
  const sorted = [...postings].reverse();
  await state.storage.updateAdminOrderOzonPostings(
    "order-1",
    postings,
    "admin-1",
  );
  assert.deepEqual(state.order.ozonPostings, sorted);
  assert.equal(state.order.crmStatus, "DELIVERING");
  assert.equal(state.order.paymentStatus, "PAID");
  assert.deepEqual(state.histories, [
    {
      data: {
        orderId: "order-1",
        authorId: "admin-1",
        eventType: "ozon_postings_updated",
        payload: {
          previousPostings: [{ number: "1-2-3", scheme: "fbo" }],
          ozonPostings: sorted,
        },
      },
    },
  ]);
  assert.deepEqual(state.trackingRequests[0]?.create.ozonPostings, sorted);
  await state.storage.updateAdminOrderOzonPostings(
    "order-1",
    postings,
    "admin-1",
  );
  assert.equal(state.histories.length, 1);
  assert.deepEqual(state.counts(), { locks: 4, updates: 1 });
  await state.storage.updateAdminOrderOzonPostings("order-1", [], "admin-1");
  assert.deepEqual(state.order.ozonPostings, []);
  assert.equal(state.trackingRequests[1]?.update.enabled, false);
});

test("Ozon postings cannot be attached to a CDEK order", async () => {
  const state = createStorage("CDEK");
  await assert.rejects(
    state.storage.updateAdminOrderOzonPostings(
      "order-1",
      [{ number: "1-2-4", scheme: "fbs" }],
      "admin-1",
    ),
    /provider must be Ozon/,
  );
  assert.equal(state.counts().updates, 0);
});

test("changing only the scheme replaces the posting and invalidates the previous tracking revision", async () => {
  const state = createStorage();
  const fbs: OzonPosting[] = [{ number: "1-2-3", scheme: "fbs" }];
  await state.storage.updateAdminOrderOzonPostings("order-1", fbs, "admin-1");
  assert.deepEqual(state.order.ozonPostings, fbs);
  await state.storage.updateAdminOrderOzonPostings("order-1", fbs, "admin-1");
  assert.equal(state.histories.length, 1);
  const fbo: OzonPosting[] = [{ number: "1-2-3", scheme: "fbo" }];
  await state.storage.updateAdminOrderOzonPostings("order-1", fbo, "admin-1");
  assert.deepEqual(state.order.ozonPostings, fbo);
  assert.equal(state.histories.length, 2);
  assert.deepEqual(state.trackingRequests[0]?.create.ozonPostings, fbs);
  assert.deepEqual(state.trackingRequests[1]?.create.ozonPostings, fbo);
  assert.notEqual(
    state.trackingRequests[0]?.create.revision,
    state.trackingRequests[1]?.create.revision,
  );
});

test("a posting already linked to another order is rejected without changes", async () => {
  const state = createStorage("OZON", true);
  await assert.rejects(
    state.storage.updateAdminOrderOzonPostings(
      "order-1",
      [{ number: "1-2-4", scheme: "fbs" }],
      "admin-1",
    ),
    /already linked to another order/,
  );
  assert.equal(state.counts().updates, 0);
  assert.equal(state.histories.length, 0);
});
