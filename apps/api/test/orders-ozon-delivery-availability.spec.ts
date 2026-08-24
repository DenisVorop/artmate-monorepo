import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadGatewayException, BadRequestException } from "@nestjs/common";

import type { DeliverySelection } from "../src/delivery/providers/delivery-provider.interface";
import { OrdersService } from "../src/orders/orders.service";

const unavailableMessage = "данный товар не можем доставить через озон";

describe("Orders Ozon delivery availability", () => {
  it("rejects an unavailable Ozon checkout before delivery calculation", async () => {
    const fixture = createOrdersServiceFixture();

    await assert.rejects(
      fixture.service.calculateCheckout("cart-1", {
        delivery: { provider: "ozon", pickupPointId: "11" },
      }),
      isOzonUnavailableError,
    );
    assert.equal(fixture.getCartCallCount(), 1);
    assert.equal(fixture.getDeliveryCallCount(), 0);
  });

  it("rejects an unavailable Ozon order before delivery or persistence", async () => {
    const fixture = createOrdersServiceFixture();

    await assert.rejects(
      fixture.service.createOrder(
        "cart-1",
        {
          acceptedLegal: true,
          acceptedPersonalDataConsent: true,
          customer: {
            email: "customer@example.com",
            name: "Customer",
            phone: "+79990000000",
          },
          delivery: { provider: "ozon", pickupPointId: "11" },
          payment: { method: "bank_card_mock" },
        },
        {
          id: "user-1",
          provider: "credentials",
          providerUserId: "user-1",
          roles: [],
        },
      ),
      isOzonUnavailableError,
    );
    assert.equal(fixture.getCartCallCount(), 1);
    assert.equal(fixture.getDeliveryCallCount(), 0);
    assert.equal(fixture.getCreateOrderCallCount(), 0);
  });

  it("allows CDEK checkout when Ozon delivery is unavailable", async () => {
    const fixture = createOrdersServiceFixture();

    const checkout = await fixture.service.calculateCheckout("cart-1", {
      delivery: { cityCode: 44, provider: "cdek", pickupPointId: "cdek-1" },
    });

    assert.equal(checkout.delivery.provider, "cdek");
    assert.equal(fixture.getCartCallCount(), 1);
    assert.equal(fixture.getDeliveryCallCount(), 1);
  });

  it("resolves the selected Ozon point again before creating an order", async () => {
    const invalidPointError = new BadGatewayException(
      "Ozon Logistics point-info item is invalid",
    );
    const fixture = createOrdersServiceFixture({
      deliveryErrorOnCall: 2,
      isOzonDeliveryAvailable: true,
      invalidPointError,
    });
    const delivery = { provider: "ozon" as const, pickupPointId: "11" };

    const checkout = await fixture.service.calculateCheckout("cart-1", {
      delivery,
    });

    assert.equal(checkout.delivery.pickupPoint.id, "point-1");
    await assert.rejects(
      fixture.service.createOrder(
        "cart-1",
        {
          acceptedLegal: true,
          acceptedPersonalDataConsent: true,
          customer: {
            email: "customer@example.com",
            name: "Customer",
            phone: "+79990000000",
          },
          delivery,
          payment: { method: "bank_card_mock" },
        },
        {
          id: "user-1",
          provider: "credentials",
          providerUserId: "user-1",
          roles: [],
        },
      ),
      (error) => error === invalidPointError,
    );
    assert.equal(fixture.getCartCallCount(), 2);
    assert.equal(fixture.getDeliveryCallCount(), 2);
    assert.equal(fixture.getCreateOrderCallCount(), 0);
  });

  it("preserves an opaque Ozon point ID through checkout request parsing", async () => {
    const fixture = createOrdersServiceFixture({
      isOzonDeliveryAvailable: true,
    });
    const pickupPointId = ` Ozon/opaque:001-${"x".repeat(142)} `;

    await fixture.service.calculateCheckout("cart-1", {
      delivery: { provider: "ozon", pickupPointId },
    });

    assert.equal(pickupPointId.length, 160);
    assert.equal(fixture.getLastPickupPointId(), pickupPointId);
  });
});

function createOrdersServiceFixture(
  options: {
    deliveryErrorOnCall?: number;
    invalidPointError?: Error;
    isOzonDeliveryAvailable?: boolean;
  } = {},
) {
  let createOrderCallCount = 0;
  let deliveryCallCount = 0;
  let getCartCallCount = 0;
  let lastPickupPointId: string | undefined;
  const cart = {
    currency: "RUB" as const,
    id: "cart-1",
    isOzonDeliveryAvailable: options.isOzonDeliveryAvailable ?? false,
    items: [
      {
        id: "product-1",
        image: "/product.jpg",
        lineTotal: 1_000,
        price: 1_000,
        quantity: 1,
        slug: "product-1",
        title: "Product 1",
      },
    ],
    itemsCount: 1,
    subtotal: 1_000,
    total: 1_000,
  };
  const service = Object.assign(
    Object.create(OrdersService.prototype) as object,
    {
      cartService: {
        assertItemsInStock: async () => undefined,
        getCart: async () => {
          getCartCallCount += 1;
          return cart;
        },
      },
      cartStorage: {
        ensureCart: async () => ({ id: cart.id }),
        getDTO: () => cart,
      },
      deliveryService: {
        calculatePickupPointDelivery: async (selection: DeliverySelection) => {
          deliveryCallCount += 1;
          lastPickupPointId = selection.pickupPointId;

          if (deliveryCallCount === options.deliveryErrorOnCall) {
            throw options.invalidPointError;
          }

          return {
            deliveryPrice: 0,
            pickupPoint: {
              address: "Pickup point",
              deliveryPrice: 0,
              id: "point-1",
              title: "Pickup point",
              workHours: "10:00-20:00",
            },
            provider: selection.provider,
          };
        },
      },
      ordersStorage: {
        createOrder: async () => {
          createOrderCallCount += 1;
          throw new Error("Order creation must not be reached");
        },
      },
    },
  ) as unknown as OrdersService;

  return {
    getCartCallCount: () => getCartCallCount,
    getCreateOrderCallCount: () => createOrderCallCount,
    getDeliveryCallCount: () => deliveryCallCount,
    getLastPickupPointId: () => lastPickupPointId,
    service,
  };
}

function isOzonUnavailableError(error: unknown) {
  return (
    error instanceof BadRequestException && error.message === unavailableMessage
  );
}
