import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OrdersService } from "../src/orders/orders.service";
import { OrdersStorage } from "../src/orders/orders.storage";
import { calculatePromoPricing } from "../src/promocodes/pricing";

describe("promocode order checkout integration", () => {
  it("returns gross subtotal, discount and net total with unchanged delivery", async () => {
    const fixture = createFixture({ itemCount: 2 });
    const result = await fixture.service.calculateCheckout(
      "cart-1",
      {
        delivery: { provider: "cdek", pickupPointId: "point-1" },
        promoCode: "SALE10",
      },
      {
        id: "user-1",
        provider: "credentials",
        providerUserId: "user-1",
        roles: [],
      },
    );

    assert.equal(result.subtotal, 1_998);
    assert.equal(result.discount, 100);
    assert.equal(result.deliveryPrice, 490);
    assert.equal(result.total, 2_388);
    assert.equal(result.promoCode, "SALE10");
  });

  it("rejects zero-price groups before creating an order", async () => {
    const fixture = createFixture({ zeroPrice: true });
    await assert.rejects(
      fixture.service.createOrder("cart-1", orderRequest("ozon_acquiring"), {
        id: "user-1",
        provider: "credentials",
        providerUserId: "user-1",
        roles: [],
      }),
      /нулевой ценой/,
    );
    assert.equal(fixture.createOrderCount(), 0);
  });

  it("rejects a T-Bank receipt over 100 rows before creating an order", async () => {
    const fixture = createFixture({ itemCount: 50, splitGroups: true });
    await assert.rejects(
      fixture.service.createOrder("cart-1", orderRequest("tbank_acquiring"), {
        id: "user-1",
        provider: "credentials",
        providerUserId: "user-1",
        roles: [],
      }),
      /100 позиций/,
    );
    assert.equal(fixture.createOrderCount(), 0);
  });

  it("passes only the selected code, never client totals, to transactional storage", async () => {
    const fixture = createFixture({ itemCount: 1 });
    await fixture.service.createOrder(
      "cart-1",
      orderRequest("bank_card_mock"),
      {
        id: "user-1",
        provider: "credentials",
        providerUserId: "user-1",
        roles: [],
      },
    );
    assert.equal(fixture.lastCreateInput()?.promoCode, "SALE10");
    assert.equal("discount" in (fixture.lastCreateInput() ?? {}), false);
    assert.equal("total" in (fixture.lastCreateInput() ?? {}), false);
  });

  it("returns 400 when transactional promo recheck expands a T-Bank receipt over 100 rows", () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      id: `product-${index}`,
      quantity: 3,
      unitPriceKopecks: 99_900,
    }));
    const prechecked = calculatePromoPricing(items, {
      amountKopecks: 150,
      type: "fixed",
    });
    const transactional = calculatePromoPricing(items, {
      amountKopecks: 100,
      type: "fixed",
    });
    const rowCount = (pricing: typeof prechecked) =>
      pricing.items.reduce(
        (count, item) => count + item.priceGroups.length,
        0,
      ) + 1;
    assert.equal(rowCount(prechecked), 51);
    assert.equal(rowCount(transactional), 101);

    const storage = Object.create(OrdersStorage.prototype) as OrdersStorage;
    const assertReceiptPricing = (
      storage as unknown as {
        assertReceiptPricing: (
          pricing: typeof transactional,
          deliveryPrice: number,
          paymentMethod: "tbank_acquiring",
        ) => void;
      }
    ).assertReceiptPricing.bind(storage);
    assert.throws(
      () => assertReceiptPricing(transactional, 490, "tbank_acquiring"),
      (error: unknown) =>
        error instanceof Error &&
        "getStatus" in error &&
        typeof error.getStatus === "function" &&
        error.getStatus() === 400,
    );
  });
});

function createFixture(options: {
  itemCount?: number;
  splitGroups?: boolean;
  zeroPrice?: boolean;
}) {
  const itemCount = options.itemCount ?? 1;
  const items = Array.from({ length: itemCount }, (_, index) => ({
    id: `product-${index}`,
    image: "/product.jpg",
    lineTotal: options.splitGroups ? 2_997 : 999,
    price: 999,
    quantity: options.splitGroups ? 3 : 1,
    slug: `product-${index}`,
    title: `Product ${index}`,
  }));
  let createOrderCalls = 0;
  let createInput: Record<string, unknown> | undefined;
  const pricingItems = items.map((item) => ({
    id: item.id,
    unitPriceKopecks: 99_900,
    quantity: options.splitGroups ? 3 : 1,
    subtotalKopecks: options.splitGroups ? 299_700 : 99_900,
    discountKopecks: options.zeroPrice ? 99_900 : 0,
    totalKopecks: options.zeroPrice
      ? 0
      : options.splitGroups
        ? 299_700
        : 99_900,
    priceGroups: options.splitGroups
      ? [
          { quantity: 2, totalKopecks: 199_800, unitPriceKopecks: 99_900 },
          { quantity: 1, totalKopecks: 99_900, unitPriceKopecks: 99_900 },
        ]
      : [
          {
            quantity: 1,
            totalKopecks: options.zeroPrice ? 0 : 99_900,
            unitPriceKopecks: options.zeroPrice ? 0 : 99_900,
          },
        ],
  }));
  const grossKopecks = itemCount * (options.splitGroups ? 299_700 : 99_900);
  const pricing = {
    subtotalKopecks: grossKopecks,
    discountKopecks: options.zeroPrice ? grossKopecks : 10_000,
    totalKopecks: options.zeroPrice ? 0 : grossKopecks - 10_000,
    items: pricingItems,
  };
  const service = Object.assign(Object.create(OrdersService.prototype), {
    cartService: {
      getCart: async () => ({
        id: "cart-1",
        items,
        itemsCount: itemCount,
        subtotal: itemCount * (options.splitGroups ? 2_997 : 999),
        total: itemCount * (options.splitGroups ? 2_997 : 999),
        currency: "RUB",
        isOzonDeliveryAvailable: true,
      }),
      assertItemsInStock: async () => undefined,
      clearCart: async () => undefined,
    },
    deliveryService: {
      calculatePickupPointDelivery: async () => ({
        provider: "cdek",
        deliveryPrice: 490,
        pickupPoint: {
          id: "point-1",
          title: "Point",
          address: "Address",
          workHours: "09:00-21:00",
          deliveryPrice: 490,
        },
      }),
    },
    promocodesService: {
      calculate: async () => ({ code: "SALE10", pricing }),
    },
    ordersStorage: {
      createOrder: async (input: Record<string, unknown>) => {
        createOrderCalls += 1;
        createInput = input;
        return {
          id: "order-1",
          cartId: "cart-1",
          payment: { method: "bank_card_mock" },
        };
      },
    },
    queueOrderCreatedNotifications: async () => undefined,
  }) as OrdersService;
  return {
    service,
    createOrderCount: () => createOrderCalls,
    lastCreateInput: () => createInput,
  };
}

function orderRequest(
  method: "bank_card_mock" | "ozon_acquiring" | "tbank_acquiring",
) {
  return {
    acceptedLegal: true,
    acceptedPersonalDataConsent: true,
    customer: {
      email: "buyer@example.com",
      name: "Buyer",
      phone: "+79990000000",
    },
    delivery: { provider: "cdek" as const, pickupPointId: "point-1" },
    payment: { method },
    promoCode: "SALE10",
  };
}
