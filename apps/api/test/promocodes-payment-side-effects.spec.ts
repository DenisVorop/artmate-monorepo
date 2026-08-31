import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OrdersService } from "../src/orders/orders.service";

describe("payment initialization side effects", () => {
  it("keeps successful Ozon initialization when cart/notification side effects fail", async () => {
    let failedWrites = 0;
    const order = createOrder("ozon_acquiring");
    const service = createService({
      order,
      createOzon: async () => ({
        acquiringOrderId: "ozon-order-1",
        paymentId: "payment-1",
        redirectUrl: "https://pay.test",
      }),
      onFailed: () => {
        failedWrites += 1;
      },
      sideEffectsFail: true,
    });

    const result = await callPrivatePayment(
      service,
      "createOzonPaymentForOrder",
      order,
    );

    assert.equal(result.id, order.id);
    assert.equal(failedWrites, 0);
  });

  it("records local T-Bank Init timeout without releasing the reservation", async () => {
    let failedWrites = 0;
    let releases = 0;
    const order = createOrder("tbank_acquiring");
    const service = createService({
      order,
      createTBank: async () => {
        throw new Error("Init timeout");
      },
      onFailed: () => {
        failedWrites += 1;
      },
      onRelease: () => {
        releases += 1;
      },
    });

    await assert.rejects(
      callPrivatePayment(service, "createTBankPaymentForOrder", order),
      /Init timeout/,
    );
    assert.equal(failedWrites, 1);
    assert.equal(releases, 0);
  });
});

function createService(options: {
  order: ReturnType<typeof createOrder>;
  createOzon?: () => Promise<Record<string, unknown>>;
  createTBank?: () => Promise<Record<string, unknown>>;
  onFailed: () => void;
  onRelease?: () => void;
  sideEffectsFail?: boolean;
}) {
  return Object.assign(Object.create(OrdersService.prototype), {
    logger: { warn: () => undefined },
    cartService: {
      clearCart: async () => {
        if (options.sideEffectsFail) throw new Error("cart clear failed");
      },
    },
    notificationQueueService: {},
    ordersStorage: {
      getOrderReceiptPricing: async () => undefined,
      attachOzonAcquiringPayment: async () => options.order,
      attachTBankAcquiringPayment: async () => options.order,
      markOzonAcquiringPaymentFailed: async () => {
        options.onFailed();
        return options.order;
      },
      markTBankAcquiringPaymentFailed: async () => {
        options.onFailed();
        return options.order;
      },
    },
    ozonAcquiringService: {
      createCheckoutPayment: options.createOzon,
    },
    tbankAcquiringService: {
      createCheckoutPayment: options.createTBank,
    },
    promocodesService: {
      releaseInTransaction: async () => options.onRelease?.(),
    },
    queueOrderCreatedNotifications: async () => {
      if (options.sideEffectsFail) throw new Error("queue failed");
    },
  }) as OrdersService;
}

function callPrivatePayment(
  service: OrdersService,
  method: "createOzonPaymentForOrder" | "createTBankPaymentForOrder",
  order: ReturnType<typeof createOrder>,
) {
  return (
    service as unknown as Record<
      typeof method,
      (value: typeof order, userId: string) => Promise<typeof order>
    >
  )[method](order, "user-1");
}

function createOrder(method: "ozon_acquiring" | "tbank_acquiring") {
  return {
    id: "order-1",
    cartId: "cart-1",
    status: "waiting_payment" as const,
    customer: {
      name: "Buyer",
      phone: "+79990000000",
      email: "buyer@example.com",
    },
    delivery: {
      provider: "ozon" as const,
      pickupPoint: {
        id: "point-1",
        title: "Point",
        address: "Address",
        workHours: "09:00-21:00",
        deliveryPrice: 490,
      },
    },
    payment: { method, status: "pending" as const, redirectUrl: "/checkout" },
    items: [
      {
        id: "product-1",
        image: "/product.jpg",
        lineTotal: 2_997,
        price: 999,
        quantity: 3,
        slug: "product",
        title: "Product",
      },
    ],
    shipments: [],
    itemsCount: 3,
    subtotal: 2_997,
    discount: 100,
    promoCode: "SALE10",
    deliveryPrice: 490,
    total: 3_387,
    currency: "RUB" as const,
    createdAt: "2026-08-31T00:00:00.000Z",
  };
}
