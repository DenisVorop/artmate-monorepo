import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException, NotFoundException } from "@nestjs/common";

import { OrdersStorage } from "../src/orders/orders.storage";
import {
  createShippingPackageSnapshot,
  type ShippingPackageSnapshot,
} from "../src/products/shipping-package-profile";

const profile = {
  id: "shipping_album",
  code: "album",
  weightGrams: 400,
  lengthCm: 40,
  widthCm: 30,
  heightCm: 1,
};

function createInput(provider: "cdek" | "ozon" = "cdek") {
  return {
    userId: "user-1",
    cartId: "cart-1",
    checkoutAttemptId: "attempt-1",
    checkoutPayloadFingerprint: "a".repeat(64),
    customer: { name: "Анна", phone: "+79990000000", email: "a@example.com" },
    delivery: {
      provider,
      pickupPoint: {
        id: "point-1",
        title: "Пункт выдачи",
        address: "Москва",
        workHours: "10:00–20:00",
        deliveryPrice: 200,
      },
    },
    items: [
      {
        id: "product-1",
        title: "Альбом",
        slug: "album",
        price: 799,
        quantity: 2,
        lineTotal: 1598,
        image: "/album.png",
        shippingPackage: createShippingPackageSnapshot(profile) as
          | ShippingPackageSnapshot
          | undefined,
      },
    ],
    itemsCount: 2,
    subtotal: 1598,
    paymentMethod: "tbank_acquiring" as const,
  };
}

type SavedItem = Record<string, unknown> & {
  shippingPackageSnapshot?: unknown;
};
type SavedOrder = Record<string, unknown> & {
  items: SavedItem[];
  deliveryProvider: string;
};

function createFixture() {
  let saved: SavedOrder | undefined;
  const calls = { userReads: 0, transactions: 0, creates: 0, guestWrites: 0 };
  const tx = {
    // This buyer has no completed purchases; shipping tests use the base rate.
    $queryRaw: async () => [{ spendKopecks: "0", invalid: false }],
    order: {
      create: async ({
        data,
      }: {
        data: Record<string, unknown> & {
          deliveryProvider: string;
          items: { create: SavedItem[] };
        };
      }) => {
        calls.creates += 1;
        saved = {
          ...data,
          // Simulate the JSON database boundary, not a shared object reference.
          items: JSON.parse(JSON.stringify(data.items.create)) as SavedItem[],
          shipments: [],
          discount: 0,
          promoCode: null,
          createdAt: new Date("2026-09-16T12:00:00Z"),
        };
      },
      findUnique: async () => saved,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (!saved) throw new Error("Order not created");
        Object.assign(saved, data);
        return saved;
      },
    },
  };
  const prisma = {
    order: {
      findUnique: async () => saved,
      findFirst: async () => saved,
    },
    user: {
      findUnique: async () => {
        calls.userReads += 1;
        return { id: "user-1" };
      },
    },
    product: {
      findMany: async () => {
        throw new Error("Shipment must never read current products");
      },
    },
    $transaction: async (run: (writer: typeof tx) => Promise<unknown>) => {
      calls.transactions += 1;
      return run(tx);
    },
  };
  const storage = Object.assign(Object.create(OrdersStorage.prototype), {
    prisma,
    orderActivationService: {
      attachGuestOrderInTransaction: async () => {
        calls.guestWrites += 1;
      },
    },
    analyticsOutboxService: { enqueueOrderCreated: async () => undefined },
  }) as OrdersStorage;
  return { storage, calls, saved: () => saved };
}

describe("immutable order shipping package snapshots", () => {
  it("persists each snapshot with order items and rereads saved dimensions after profile changes", async () => {
    const fixture = createFixture();
    const input = createInput();
    const expected = structuredClone(input.items[0]!.shippingPackage);
    const order = await fixture.storage.createOrder(input);

    assert.deepEqual(await fixture.storage.getOrderReceiptPricing(order.id), [
      {
        id: "product-1",
        priceGroups: [
          { quantity: 2, unitPriceKopecks: 79_900, totalKopecks: 159_800 },
        ],
      },
    ]);

    assert.equal(fixture.calls.transactions, 1);
    assert.equal(fixture.calls.creates, 1);
    assert.deepEqual(
      fixture.saved()!.items[0]!.shippingPackageSnapshot,
      expected,
    );
    input.items[0]!.shippingPackage!.weightGrams = 999;
    input.items[0]!.shippingPackage!.lengthCm = 99;

    const shipmentItems = await fixture.storage.getCdekShipmentItems(order.id);
    assert.deepEqual(shipmentItems[0]!.shippingPackage, expected);
    assert.equal(shipmentItems[0]!.quantity, 2);
    assert.equal(shipmentItems[0]!.price, 799);
    assert.equal(shipmentItems[0]!.lineTotal, 1598);
    shipmentItems[0]!.shippingPackage!.widthCm = 99;
    assert.deepEqual(
      (await fixture.storage.getCdekShipmentItems(order.id))[0]!
        .shippingPackage,
      expected,
    );
    for (const dto of [
      order,
      await fixture.storage.getOrder(order.id, "user-1"),
    ]) {
      assert.equal("shippingPackage" in dto.items[0]!, false);
      assert.equal("shippingPackageSnapshot" in dto.items[0]!, false);
    }
  });

  it("rejects missing or invalid packages on any CDEK item before database and guest writes", async () => {
    for (const invalid of [
      undefined,
      null,
      {},
      { ...profile, version: 2 },
      {
        ...profile,
        version: 1,
        heightCm: 0,
      },
    ]) {
      const fixture = createFixture();
      const input = createInput();
      input.items.push({
        ...input.items[0]!,
        id: "product-2",
        shippingPackage: invalid as ShippingPackageSnapshot | undefined,
      });
      await assert.rejects(
        fixture.storage.createOrder(input),
        (error: unknown) =>
          error instanceof BadRequestException &&
          error.getStatus() === 400 &&
          typeof error.getResponse() === "object",
      );
      assert.deepEqual(fixture.calls, {
        userReads: 0,
        transactions: 0,
        creates: 0,
        guestWrites: 0,
      });
    }
  });

  it("does not require or persist CDEK package data on Ozon orders", async () => {
    for (const shippingPackage of [
      undefined,
      createShippingPackageSnapshot(profile),
    ]) {
      const fixture = createFixture();
      const input = createInput("ozon");
      input.items[0]!.shippingPackage = shippingPackage;
      const order = await fixture.storage.createOrder(input);
      assert.equal(
        "shippingPackageSnapshot" in fixture.saved()!.items[0]!,
        false,
      );
      assert.equal("shippingPackage" in order.items[0]!, false);
      await assert.rejects(
        fixture.storage.getCdekShipmentItems(order.id),
        BadRequestException,
      );
    }
  });

  it("fails closed on legacy, corrupted or unsupported persisted snapshots", async () => {
    for (const invalid of [
      undefined,
      null,
      {},
      { ...profile, version: 2 },
      {
        ...profile,
        version: 1,
        weightGrams: "400",
      },
    ]) {
      const fixture = createFixture();
      const order = await fixture.storage.createOrder(createInput());
      fixture.saved()!.items[0]!.shippingPackageSnapshot = invalid;
      await assert.rejects(
        fixture.storage.getCdekShipmentItems(order.id),
        (error: unknown) =>
          error instanceof BadRequestException &&
          error.getStatus() === 400 &&
          typeof error.getResponse() === "object",
      );
    }
  });

  it("reports a missing order before resolving shipment packages", async () => {
    await assert.rejects(
      createFixture().storage.getCdekShipmentItems("missing"),
      NotFoundException,
    );
  });
});
