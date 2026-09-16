import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";

import type { CartItemDTO } from "../src/cart/dto";
import type { CdekClientService } from "../src/delivery/providers/cdek/cdek-client.service";
import { CdekDeliveryProvider } from "../src/delivery/providers/cdek/cdek-delivery.provider";
import type {
  DeliveryCartItem,
  DeliverySelection,
  DeliveryShipmentOrder,
} from "../src/delivery/providers/delivery-provider.interface";
import type { OrderDTO } from "../src/orders/dto";
import { OrdersService } from "../src/orders/orders.service";
import type { OrdersStorage } from "../src/orders/orders.storage";
import type { PrismaService } from "../src/prisma/prisma.service";
import { ProductShippingService } from "../src/products/product-shipping.service";
import {
  createShippingPackageSnapshot,
  type ShippingPackageProfile,
} from "../src/products/shipping-package-profile";

const album: ShippingPackageProfile = {
  id: "shipping_album",
  code: "album",
  weightGrams: 400,
  lengthCm: 40,
  widthCm: 30,
  heightCm: 1,
};
const markers: ShippingPackageProfile = {
  id: "shipping_markers",
  code: "markers",
  weightGrams: 2600,
  lengthCm: 31,
  widthCm: 16,
  heightCm: 11,
};
const items: CartItemDTO[] = [
  {
    id: "album",
    title: "Альбом",
    slug: "album",
    image: "/album.jpg",
    price: 799,
    quantity: 2,
    lineTotal: 1598,
  },
  {
    id: "markers",
    title: "Набор 168 маркеров",
    slug: "markers",
    image: "/markers.jpg",
    price: 5000,
    quantity: 1,
    lineTotal: 5000,
  },
];
const request = {
  acceptedLegal: true,
  acceptedPersonalDataConsent: true,
  checkoutAttemptId: "shipping-attempt-1",
  customer: {
    name: "Анна Иванова",
    phone: "+7 (999) 123-45-67",
    email: "buyer@example.com",
  },
  delivery: { provider: "cdek" as const, cityCode: 44, pickupPointId: "PVZ-1" },
  payment: { method: "tbank_acquiring" as const },
};

type StoredInput = Parameters<OrdersStorage["createOrder"]>[0];
function createFixture(
  options: {
    missingProfile?: boolean;
    existingOrder?: boolean;
    existingShipment?: boolean;
  } = {},
) {
  const profiles = new Map([
    ["album", { ...album }],
    ["markers", { ...markers }],
  ]);
  const calls = {
    profileReads: 0,
    cartReads: 0,
    payments: 0,
    shipmentReads: 0,
  };
  const requests: Array<{ path: string; body?: { packages: unknown[] } }> = [];
  const stored: StoredInput[] = [];
  const calculatedItems: DeliveryCartItem[][] = [];
  const shipments: DeliveryShipmentOrder[] = [];
  let savedItems: DeliveryCartItem[] = [];
  const order = {
    id: "AM-TEST",
    customer: request.customer,
    delivery: { provider: "cdek", pickupPoint: { id: "PVZ-1" } },
    items: structuredClone(items),
  } as OrderDTO;
  const cdek = new CdekDeliveryProvider({
    request: async (
      path: string,
      init: { body?: { packages: unknown[] } } = {},
    ) => {
      requests.push({ path, body: init.body });
      if (path === "/v2/deliverypoints")
        return [
          {
            code: "PVZ-1",
            name: "Пункт",
            work_time: "09:00-21:00",
            location: { address_full: "Москва" },
          },
        ];
      return { total_sum: 321 };
    },
  } as unknown as CdekClientService);
  const productShippingService = new ProductShippingService({
    product: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        calls.profileReads += 1;
        return where.id.in.map((id) => ({
          id,
          shippingPackageProfile: options.missingProfile
            ? null
            : profiles.get(id),
        }));
      },
    },
  } as unknown as PrismaService);
  const service = Object.assign(Object.create(OrdersService.prototype), {
    logger: { warn: () => undefined },
    cartService: {
      getCart: async () => {
        calls.cartReads += 1;
        return {
          id: "cart-1",
          items: structuredClone(items),
          itemsCount: 3,
          subtotal: 6598,
          total: 6598,
          currency: "RUB",
          isOzonDeliveryAvailable: true,
        };
      },
      assertItemsInStock: async () => undefined,
    },
    productShippingService,
    deliveryService: {
      calculatePickupPointDelivery: async (
        selection: DeliverySelection,
        deliveryItems: DeliveryCartItem[],
      ) => {
        calculatedItems.push(deliveryItems);
        if (selection.provider === "cdek")
          return cdek.calculatePickupPointDelivery({
            selection,
            items: deliveryItems,
          });
        return {
          provider: "ozon",
          deliveryPrice: 100,
          pickupPoint: {
            id: "OZON-1",
            title: "Пункт",
            address: "Москва",
            workHours: "09:00-21:00",
            deliveryPrice: 100,
          },
        };
      },
      createCdekOrder: async (shipment: DeliveryShipmentOrder) => {
        shipments.push(shipment);
        return { requestState: "ACCEPTED", responsePayload: {} };
      },
    },
    ordersStorage: {
      getOrderByCheckoutAttempt: async () =>
        options.existingOrder ? order : undefined,
      createOrder: async (input: StoredInput) => {
        stored.push(input);
        savedItems = structuredClone(input.items);
        return order;
      },
      getCdekShipmentItems: async (orderId: string) => {
        assert.equal(orderId, order.id);
        calls.shipmentReads += 1;
        return structuredClone(savedItems);
      },
      claimOrderShipmentCreation: async () => ({
        shouldCreate: !options.existingShipment,
        shipment: {
          externalUuid: options.existingShipment
            ? "existing-cdek-id"
            : undefined,
        },
      }),
      upsertOrderShipment: async (input: unknown) => input,
    },
    initializePaymentForOrder: async (value: OrderDTO) => {
      calls.payments += 1;
      return value;
    },
    isCdekOrderCreationEnabled: () => true,
    syncCdekShipmentWithTrackNumber: async (
      orderId: string,
      externalUuid: string,
    ) => {
      assert.equal(orderId, order.id);
      assert.equal(externalUuid, "existing-cdek-id");
      return { externalUuid };
    },
  }) as OrdersService;
  const ship = (value: OrderDTO) =>
    (
      service as unknown as {
        ensureCdekShipmentForPaidOrder(order: OrderDTO): Promise<unknown>;
      }
    ).ensureCdekShipmentForPaidOrder(value);
  return {
    service,
    ship,
    calls,
    profiles,
    requests,
    stored,
    calculatedItems,
    shipments,
    order,
  };
}

describe("CDEK checkout shipping orchestration", () => {
  it("calculates two album packages and one whole marker set from product profiles", async () => {
    const fixture = createFixture();
    const result = await fixture.service.calculateCheckout("cart-1", {
      delivery: request.delivery,
    });
    assert.equal(result.deliveryPrice, 321);
    assert.equal(result.total, 6919);
    assert.equal(fixture.calls.profileReads, 1);
    assert.deepEqual(
      fixture.requests.find(({ path }) => path === "/v2/calculator/tariff")
        ?.body?.packages,
      [
        { height: 1, length: 40, width: 30, weight: 400 },
        { height: 1, length: 40, width: 30, weight: 400 },
        { height: 11, length: 31, width: 16, weight: 2600 },
      ],
    );
  });

  it("persists exactly the profiles used for this order's calculation", async () => {
    const fixture = createFixture();
    await fixture.service.createOrder("cart-1", request);
    assert.equal(fixture.calls.profileReads, 1);
    assert.equal(fixture.calls.payments, 1);
    assert.strictEqual(fixture.stored[0]!.items, fixture.calculatedItems[0]);
    assert.deepEqual(
      fixture.stored[0]!.items.map((item) => item.shippingPackage),
      [
        createShippingPackageSnapshot(album),
        createShippingPackageSnapshot(markers),
      ],
    );
    assert.equal(fixture.stored[0]!.subtotal, 6598);
  });

  it("loads paid shipment items from the order snapshot despite current product changes", async () => {
    const fixture = createFixture();
    await fixture.service.createOrder("cart-1", request);
    fixture.profiles.get("markers")!.weightGrams = 9999;
    fixture.order.items = [];
    await fixture.ship(fixture.order);
    assert.equal(fixture.calls.profileReads, 1);
    assert.equal(fixture.calls.shipmentReads, 1);
    assert.deepEqual(
      fixture.shipments[0]!.items.map((item) => item.shippingPackage),
      [
        createShippingPackageSnapshot(album),
        createShippingPackageSnapshot(markers),
      ],
    );
    assert.deepEqual(
      fixture.shipments[0]!.items.map((item) => item.quantity),
      [2, 1],
    );
  });

  it("does not resolve or require profiles for Ozon checkout and order creation", async () => {
    const fixture = createFixture({ missingProfile: true });
    const delivery = { provider: "ozon" as const, pickupPointId: "OZON-1" };
    const result = await fixture.service.calculateCheckout("cart-1", {
      delivery,
    });
    await fixture.service.createOrder("cart-1", { ...request, delivery });
    assert.equal(result.deliveryPrice, 100);
    assert.equal(fixture.calls.profileReads, 0);
    assert.equal(fixture.requests.length, 0);
    assert.equal(
      fixture.stored[0]!.items.every((item) => !("shippingPackage" in item)),
      true,
    );
  });

  it("rejects missing profiles before carrier requests, persistence or payment", async () => {
    const fixture = createFixture({ missingProfile: true });
    await assert.rejects(
      fixture.service.calculateCheckout("cart-1", {
        delivery: request.delivery,
      }),
      BadRequestException,
    );
    await assert.rejects(
      fixture.service.createOrder("cart-1", request),
      BadRequestException,
    );
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.stored.length, 0);
    assert.equal(fixture.calls.payments, 0);
  });

  it("reuses an existing attempt without recalculating or replacing its packages", async () => {
    const fixture = createFixture({
      existingOrder: true,
      missingProfile: true,
    });
    assert.equal(
      await fixture.service.createOrder("cart-1", request),
      fixture.order,
    );
    assert.equal(fixture.calls.cartReads, 0);
    assert.equal(fixture.calls.profileReads, 0);
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.stored.length, 0);
    assert.equal(fixture.calls.payments, 1);
  });

  it("syncs an existing legacy shipment without loading or inventing package snapshots", async () => {
    const fixture = createFixture({
      existingShipment: true,
      missingProfile: true,
    });
    assert.deepEqual(await fixture.ship(fixture.order), {
      externalUuid: "existing-cdek-id",
    });
    assert.equal(fixture.calls.profileReads, 0);
    assert.equal(fixture.calls.shipmentReads, 0);
    assert.equal(fixture.shipments.length, 0);
  });
});
