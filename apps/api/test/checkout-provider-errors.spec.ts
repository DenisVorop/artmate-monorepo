import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from "@nestjs/common";

import { OrdersService } from "../src/orders/orders.service";
import { OzonAcquiringService } from "../src/ozon/ozon-acquiring.service";
import { OzonLogisticsService } from "../src/ozon/ozon-logistics.service";
import type { OzonOAuthService } from "../src/ozon/ozon-oauth.service";
import { TBankAcquiringService } from "../src/tbank/tbank-acquiring.service";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const privateBodySentinel = "PRIVATE_PROVIDER_BODY_SENTINEL";
const privateDetailsSentinel = "PRIVATE_PROVIDER_DETAILS_SENTINEL";
const privateErrorCodeSentinel = "PRIVATE_ERROR_CODE_SENTINEL";

const paymentInput = {
  amount: 1_100,
  customer: {
    email: "buyer@example.com",
    name: "Buyer",
    phone: "+79990000000",
  },
  deliveryPrice: 100,
  deliveryProvider: "ozon" as const,
  failUrl: "https://site.test/failure",
  items: [
    {
      id: "product-1",
      image: "/product.jpg",
      lineTotal: 1_000,
      price: 1_000,
      quantity: 1,
      slug: "product-1",
      title: "Product",
    },
  ],
  notificationUrl: "https://api.test/notification",
  orderId: "order-1",
  successUrl: "https://site.test/success",
};

describe("checkout provider error boundaries", () => {
  beforeEach(() => {
    process.env.OZON_ACQUIRING_ACCESS_KEY = "test-access";
    process.env.OZON_ACQUIRING_BASE_URL = "https://ozon.test";
    process.env.OZON_ACQUIRING_SECRET_KEY = "test-secret";
    process.env.OZON_LOGISTICS_MODE = "real";
    process.env.TBANK_ACQUIRING_BASE_URL = "https://tbank.test";
    process.env.TBANK_ACQUIRING_PASSWORD = "test-password";
    process.env.TBANK_ACQUIRING_TAX = "none";
    process.env.TBANK_ACQUIRING_TAXATION = "usn_income";
    process.env.TBANK_ACQUIRING_TERMINAL_KEY = "test-terminal";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("keeps Ozon Init diagnostics in Logger and returns only a stable buyer message", async () => {
    globalThis.fetch = async () =>
      jsonResponse(
        {
          details: [privateDetailsSentinel],
          message: privateBodySentinel,
          requestSign: "PRIVATE_SECRET_SENTINEL",
        },
        597,
      );
    const service = new OzonAcquiringService();
    const logs = captureWarnings(service);

    await assert.rejects(
      service.createCheckoutPayment(paymentInput),
      hasPublicResponse(
        "Не удалось начать оплату через Ozon. Попробуйте еще раз.",
      ),
    );
    assert.match(logs.join("\n"), /status 597/u);
    assert.match(logs.join("\n"), new RegExp(privateBodySentinel, "u"));
    assert.match(logs.join("\n"), new RegExp(privateDetailsSentinel, "u"));
    assert.doesNotMatch(logs.join("\n"), /PRIVATE_SECRET_SENTINEL/u);
  });

  it("keeps T-Bank Init diagnostics in Logger and returns only a stable buyer message", async () => {
    globalThis.fetch = async () =>
      jsonResponse(
        {
          Details: privateDetailsSentinel,
          ErrorCode: "PRIVATE_ERROR_CODE_SENTINEL",
          Message: privateBodySentinel,
          Success: false,
          Token: "PRIVATE_SECRET_SENTINEL",
        },
        598,
      );
    const service = new TBankAcquiringService();
    const logs = captureWarnings(service);

    await assert.rejects(
      service.createCheckoutPayment(paymentInput),
      hasPublicResponse(
        "Не удалось начать оплату через T-Bank. Попробуйте еще раз.",
      ),
    );
    assert.match(logs.join("\n"), /status 598/u);
    assert.match(logs.join("\n"), new RegExp(privateBodySentinel, "u"));
    assert.match(logs.join("\n"), new RegExp(privateDetailsSentinel, "u"));
    assert.match(logs.join("\n"), /PRIVATE_ERROR_CODE_SENTINEL/u);
    assert.doesNotMatch(logs.join("\n"), /PRIVATE_SECRET_SENTINEL/u);
  });

  it("sanitizes Ozon and T-Bank Init transport failures", async () => {
    const ozonService = new OzonAcquiringService();
    const tbankService = new TBankAcquiringService();
    const cases: Array<[object, () => Promise<unknown>, string]> = [
      [
        ozonService,
        () => ozonService.createCheckoutPayment(paymentInput),
        "Не удалось начать оплату через Ozon. Попробуйте еще раз.",
      ],
      [
        tbankService,
        () => tbankService.createCheckoutPayment(paymentInput),
        "Не удалось начать оплату через T-Bank. Попробуйте еще раз.",
      ],
    ];

    for (const [service, operation, message] of cases) {
      const logs = captureWarnings(service);
      globalThis.fetch = async () => {
        throw new Error(privateBodySentinel);
      };

      await assert.rejects(operation(), hasPublicResponse(message));
      assert.match(logs.join("\n"), new RegExp(privateBodySentinel, "u"));
    }
  });

  it("records acquiring diagnostics internally and returns one neutral payment-init error", async () => {
    const cases = [
      ["ozon", "createOzonPaymentForOrder"],
      ["tbank", "createTBankPaymentForOrder"],
    ] as const;

    for (const [provider, method] of cases) {
      const providerError = new HttpException(
        {
          body: privateBodySentinel,
          Details: privateDetailsSentinel,
          ErrorCode: privateErrorCodeSentinel,
          provider,
          status: 598,
        },
        502,
      );
      const diagnostics: string[] = [];
      const logs: string[] = [];
      const service = createOrdersServiceWithPaymentFailure(
        provider,
        providerError,
        diagnostics,
        logs,
      );

      await assert.rejects(
        callPaymentInitialization(service, method),
        hasPublicResponse("Не удалось начать оплату. Попробуйте еще раз.", 503),
      );
      for (const internalOutput of [diagnostics.join("\n"), logs.join("\n")]) {
        assert.match(internalOutput, new RegExp(privateBodySentinel, "u"));
        assert.match(internalOutput, new RegExp(privateDetailsSentinel, "u"));
        assert.match(internalOutput, new RegExp(privateErrorCodeSentinel, "u"));
        assert.match(internalOutput, /status/u);
      }
    }
  });

  it("sanitizes Ozon selected-point provider failures", async () => {
    const providerError = new HttpException(
      {
        body: {
          authorization: "PRIVATE_SECRET_SENTINEL",
          details: privateDetailsSentinel,
          message: privateBodySentinel,
        },
        message: "Ozon Seller API request failed",
        status: 599,
      },
      599,
    );
    const service = new OzonLogisticsService({
      requestSellerApi: async () => {
        throw providerError;
      },
    } as unknown as OzonOAuthService);
    const logs = captureWarnings(service);
    await assert.rejects(
      service.getPickupPoint("point-1"),
      hasPublicResponse(
        "Не удалось проверить пункт выдачи Ozon. Попробуйте еще раз.",
      ),
    );
    assert.match(logs.join("\n"), /599/u);
    assert.match(logs.join("\n"), new RegExp(privateBodySentinel, "u"));
    assert.match(logs.join("\n"), new RegExp(privateDetailsSentinel, "u"));
    assert.doesNotMatch(logs.join("\n"), /PRIVATE_SECRET_SENTINEL/u);
  });

  it("sanitizes CDEK and Ozon failures at checkout delivery boundaries", async () => {
    for (const provider of ["cdek", "ozon"] as const) {
      const providerError = new HttpException(
        {
          body: privateBodySentinel,
          details: privateDetailsSentinel,
          ErrorCode: privateErrorCodeSentinel,
          provider,
          status: 596,
        },
        provider === "cdek" ? 422 : 502,
      );
      const service = createOrdersServiceWithDeliveryFailure(providerError);
      const logs = captureWarnings(service);
      const delivery = {
        cityCode: provider === "cdek" ? 44 : undefined,
        pickupPointId: "point-1",
        provider,
      };

      await assert.rejects(
        service.calculateCheckout("cart-1", { delivery }),
        hasPublicResponse(
          "Не удалось рассчитать доставку. Попробуйте еще раз.",
          503,
        ),
      );
      await assert.rejects(
        service.createOrder("cart-1", {
          acceptedLegal: true,
          acceptedPersonalDataConsent: true,
          checkoutAttemptId: `attempt-${provider}`,
          customer: {
            email: "buyer@example.com",
            name: "Анна Иванова",
            phone: "+7 (999) 000-00-00",
          },
          delivery,
          payment: { method: "tbank_acquiring" },
        }),
        hasPublicResponse(
          "Не удалось рассчитать доставку. Попробуйте еще раз.",
          503,
        ),
      );
      assert.match(logs.join("\n"), /596/u);
      assert.match(logs.join("\n"), new RegExp(privateBodySentinel, "u"));
      assert.match(logs.join("\n"), new RegExp(privateDetailsSentinel, "u"));
      assert.match(logs.join("\n"), new RegExp(privateErrorCodeSentinel, "u"));
    }
  });

  it("preserves controlled checkout delivery validation errors", async () => {
    const validationError = new BadRequestException(
      "CDEK pickup point is invalid",
    );
    const service = createOrdersServiceWithDeliveryFailure(validationError);

    await assert.rejects(
      service.calculateCheckout("cart-1", {
        delivery: { cityCode: 44, pickupPointId: "missing", provider: "cdek" },
      }),
      (error: unknown) => {
        assert.equal(error, validationError);
        return true;
      },
    );
  });
});

function captureWarnings(service: object) {
  const warnings: string[] = [];
  (service as { logger: { warn(message: unknown): void } }).logger = {
    warn: (message) => warnings.push(String(message)),
  };
  return warnings;
}

function hasPublicResponse(message: string, status = 502) {
  return (error: unknown) => {
    assert.ok(error instanceof HttpException);
    assert.ok(
      status === 502
        ? error instanceof BadGatewayException
        : error instanceof ServiceUnavailableException,
    );
    assert.equal(error.message, message);
    const serialized = JSON.stringify(error.getResponse());
    assert.deepEqual(error.getResponse(), {
      error: status === 502 ? "Bad Gateway" : "Service Unavailable",
      message,
      statusCode: status,
    });
    assert.doesNotMatch(
      serialized,
      /PRIVATE_PROVIDER|PRIVATE_ERROR_CODE|597|598|599/u,
    );
    assert.doesNotMatch(serialized, /body|details|ozonStatus|tbankStatus/u);
    return true;
  };
}

function callPaymentInitialization(
  service: OrdersService,
  method: "createOzonPaymentForOrder" | "createTBankPaymentForOrder",
) {
  return (
    service as unknown as Record<
      typeof method,
      (
        order: ReturnType<typeof createPaymentOrder>,
        userId?: string,
      ) => Promise<unknown>
    >
  )[method](
    createPaymentOrder(
      method === "createOzonPaymentForOrder"
        ? "ozon_acquiring"
        : "tbank_acquiring",
    ),
  );
}

function createOrdersServiceWithPaymentFailure(
  provider: "ozon" | "tbank",
  error: Error,
  diagnostics: string[],
  logs: string[],
) {
  const fail = async () => {
    throw error;
  };

  return Object.assign(Object.create(OrdersService.prototype), {
    logger: { warn: (message: unknown) => logs.push(String(message)) },
    ordersStorage: {
      getOrderReceiptPricing: async () => undefined,
      markOzonAcquiringPaymentFailed: async (
        _orderId: string,
        input: { errorMessage: string },
      ) => diagnostics.push(input.errorMessage),
      markTBankAcquiringPaymentFailed: async (
        _orderId: string,
        input: { errorMessage: string },
      ) => diagnostics.push(input.errorMessage),
    },
    ozonAcquiringService: {
      createCheckoutPayment: provider === "ozon" ? fail : undefined,
    },
    tbankAcquiringService: {
      createCheckoutPayment: provider === "tbank" ? fail : undefined,
    },
  }) as OrdersService;
}

function createPaymentOrder(method: "ozon_acquiring" | "tbank_acquiring") {
  return {
    ...paymentInput,
    cartId: "cart-1",
    createdAt: "2026-09-07T00:00:00.000Z",
    currency: "RUB" as const,
    delivery: {
      pickupPoint: {
        address: "Address",
        deliveryPrice: 100,
        id: "point-1",
        title: "Point",
        workHours: "09:00-21:00",
      },
      provider: "ozon" as const,
    },
    discount: 0,
    itemsCount: 1,
    payment: { method, status: "pending" as const },
    shipments: [],
    status: "waiting_payment" as const,
    subtotal: 1_000,
    total: 1_100,
  };
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function createOrdersServiceWithDeliveryFailure(error: Error) {
  const cart = {
    currency: "RUB" as const,
    id: "cart-1",
    isOzonDeliveryAvailable: true,
    items: [paymentInput.items[0]],
    itemsCount: 1,
    subtotal: 1_000,
    total: 1_000,
  };

  return Object.assign(Object.create(OrdersService.prototype), {
    cartService: {
      assertItemsInStock: async () => undefined,
      getCart: async () => cart,
    },
    deliveryService: {
      calculatePickupPointDelivery: async () => {
        throw error;
      },
    },
    logger: { warn: () => undefined },
    ordersStorage: {
      createOrder: async () => {
        throw new Error("order persistence must not be reached");
      },
      getOrderByCheckoutAttempt: async () => undefined,
    },
  }) as OrdersService;
}
