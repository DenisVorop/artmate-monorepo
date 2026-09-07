import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HttpException, HttpStatus } from "@nestjs/common";
import { GUARDS_METADATA, MODULE_METADATA } from "@nestjs/common/constants";

import { AuthGuard } from "../src/auth/auth.guard";
import type { AuthService } from "../src/auth/auth.service";
import type { AuthUser } from "../src/auth/auth.types";
import { DeliveryModule } from "../src/delivery/delivery.module";
import { DeliveryProxyThrottleService } from "../src/delivery/delivery-proxy-throttle.service";
import type {
  CalculateCheckoutRequestDTO,
  CreateOrderRequestDTO,
} from "../src/orders/dto";
import { CreateOrderResponseDTO } from "../src/orders/dto";
import { OrdersController } from "../src/orders/orders.controller";
import { CheckoutThrottleService } from "../src/orders/checkout-throttle.service";
import { OrdersModule } from "../src/orders/orders.module";
import { OrdersService } from "../src/orders/orders.service";
import { OrdersStorage } from "../src/orders/orders.storage";
import type { UsersService } from "../src/users/users.service";

type ProtectedOrdersController = {
  calculateCheckout(
    request: CalculateCheckoutRequestDTO,
    cookieHeader: string | undefined,
    forwardedFor: string | undefined,
    realIp: string | undefined,
    requestIp: string | undefined,
    authorization: string | undefined,
  ): unknown;
  createOrder(
    request: CreateOrderRequestDTO,
    cookieHeader: string | undefined,
    forwardedFor: string | undefined,
    realIp: string | undefined,
    requestIp: string | undefined,
    authorization: string | undefined,
  ): Promise<unknown>;
  recoverPayment(
    orderId: string,
    cookieHeader: string | undefined,
  ): Promise<unknown>;
};

const identity = {
  cookieHeader: "cart_id=cart-1; artmate_access_token=token-1",
  forwardedFor: "203.0.113.10",
  realIp: "198.51.100.20",
  requestIp: "127.0.0.1",
};
const user: AuthUser = {
  id: "user-1",
  provider: "credentials",
  providerUserId: "user-1",
  roles: [],
};
const ozonCheckoutRequest = {
  delivery: { pickupPointId: "ozon-1", provider: "ozon" as const },
};
const ozonOrderRequest = {
  acceptedLegal: true,
  acceptedPersonalDataConsent: true,
  checkoutAttemptId: "attempt-1",
  customer: {
    email: "customer@example.com",
    name: "Customer",
    phone: "+79990000000",
  },
  delivery: { pickupPointId: "ozon-1", provider: "ozon" as const },
  payment: { method: "tbank_acquiring" as const },
};

describe("OrdersController Ozon proxy protection", () => {
  it("throttles Ozon checkout calculation exactly once before OrdersService", async () => {
    const fixture = createFixture();

    await fixture.controller.calculateCheckout(
      ozonCheckoutRequest,
      identity.cookieHeader,
      identity.forwardedFor,
      identity.realIp,
      identity.requestIp,
      undefined,
    );

    assert.deepEqual(fixture.events, ["throttle", "calculateCheckout"]);
    assert.deepEqual(fixture.throttleCalls, [identity]);
  });

  it("throttles Ozon order creation exactly once before OrdersService", async () => {
    const fixture = createFixture();

    await fixture.controller.createOrder(
      ozonOrderRequest,
      identity.cookieHeader,
      identity.forwardedFor,
      identity.realIp,
      identity.requestIp,
      undefined,
    );

    assert.deepEqual(fixture.events, ["throttle", "createOrder"]);
    assert.deepEqual(fixture.throttleCalls, [identity]);
  });

  it("does not call OrdersService when the Ozon throttle rejects with 429", async () => {
    const throttleError = new HttpException(
      "Too many Ozon delivery requests",
      HttpStatus.TOO_MANY_REQUESTS,
    );
    const fixture = createFixture(throttleError);

    await assert.rejects(
      async () =>
        fixture.controller.calculateCheckout(
          ozonCheckoutRequest,
          identity.cookieHeader,
          identity.forwardedFor,
          identity.realIp,
          identity.requestIp,
          undefined,
        ),
      (error) => error === throttleError,
    );
    await assert.rejects(
      fixture.controller.createOrder(
        ozonOrderRequest,
        identity.cookieHeader,
        identity.forwardedFor,
        identity.realIp,
        identity.requestIp,
        undefined,
      ),
      (error) => error === throttleError,
    );

    assert.deepEqual(fixture.events, ["throttle", "throttle"]);
    assert.equal(fixture.calculateCheckoutCalls, 0);
    assert.equal(fixture.createOrderCalls, 0);
  });

  it("does not throttle CDEK checkout calculation or order creation", async () => {
    const fixture = createFixture();
    const cdekDelivery = {
      cityCode: 44,
      pickupPointId: "cdek-1",
      provider: "cdek" as const,
    };

    await fixture.controller.calculateCheckout(
      { delivery: cdekDelivery },
      identity.cookieHeader,
      identity.forwardedFor,
      identity.realIp,
      identity.requestIp,
      undefined,
    );
    await fixture.controller.createOrder(
      { ...ozonOrderRequest, delivery: cdekDelivery },
      identity.cookieHeader,
      identity.forwardedFor,
      identity.realIp,
      identity.requestIp,
      undefined,
    );

    assert.deepEqual(fixture.events, ["calculateCheckout", "createOrder"]);
    assert.deepEqual(fixture.throttleCalls, []);
  });

  it("resolves optional auth for create and forwards guest identity to persistent throttle", async () => {
    const fixture = createFixture(undefined, undefined);

    await fixture.controller.createOrder(
      ozonOrderRequest,
      identity.cookieHeader,
      identity.forwardedFor,
      identity.realIp,
      identity.requestIp,
      undefined,
    );

    assert.deepEqual(fixture.checkoutThrottleCalls, [
      {
        cartId: "cart-1",
        forwardedFor: identity.forwardedFor,
        realIp: identity.realIp,
        requestIp: identity.requestIp,
      },
    ]);
    assert.equal(fixture.createOrderUsers[0], undefined);
  });

  it("keeps reads and status guarded while create is public and mock confirmation is absent", () => {
    assert.equal(getGuards("createOrder").includes(AuthGuard), false);
    assert.equal(getGuards("recoverPayment").includes(AuthGuard), false);
    for (const method of ["getMyOrders", "getOrder", "getOrderState"]) {
      assert.equal(getGuards(method).includes(AuthGuard), true);
    }
    assert.equal("confirmPayment" in OrdersController.prototype, false);
    assert.equal("confirmPayment" in OrdersService.prototype, false);
    assert.equal("markOrderAsPaid" in OrdersStorage.prototype, false);

    const routes = Object.getOwnPropertyNames(OrdersController.prototype).flatMap(
      (property) => {
        const handler = Object.getOwnPropertyDescriptor(
          OrdersController.prototype,
          property,
        )?.value as unknown;

        return typeof handler === "function"
          ? [Reflect.getMetadata("path", handler) as unknown]
          : [];
      },
    );
    assert.equal(routes.includes(":orderId/confirm-payment"), false);
  });

  it("forwards only the cart cookie identity to public payment recovery", async () => {
    const fixture = createFixture();

    const response = await fixture.controller.recoverPayment(
      "AM-PUBLIC1",
      "artmate_access_token=ignored; cart_id=cart-owner",
    );

    assert.deepEqual(fixture.recoveryCalls, [
      { cartId: "cart-owner", orderId: "AM-PUBLIC1" },
    ]);
    assert.deepEqual(response, { redirectUrl: "https://pay.test/recovery" });
    assert.deepEqual(Object.keys(response as object), ["redirectUrl"]);
  });

  it("returns only a safe order id and redirect while masking the internal initialization marker", async () => {
    const external = createFixture(undefined, undefined, {
      discount: 100,
      id: "private-order-id",
      itemsCount: 3,
      customer: { email: "private@example.com" },
      items: [{ id: "private-product" }],
      payment: { redirectUrl: "https://pay.test/redirect" },
      status: "waiting_payment",
      subtotal: 2_997,
    });
    const initializing = createFixture(undefined, undefined, {
      discount: 100,
      id: "private-order-id",
      itemsCount: 3,
      payment: {
        redirectUrl: "/checkout/payment-initializing?startedAt=1",
      },
      subtotal: 2_997,
    });
    const unsafe = createFixture(undefined, undefined, {
      discount: 100,
      id: "unsafe-order-id",
      itemsCount: 3,
      payment: { redirectUrl: "javascript:alert(1)" },
      subtotal: 2_997,
    });

    const externalResponse = await external.controller.createOrder(
      ozonOrderRequest,
      identity.cookieHeader,
      identity.forwardedFor,
      identity.realIp,
      identity.requestIp,
      undefined,
    );
    const initializingResponse = await initializing.controller.createOrder(
      ozonOrderRequest,
      identity.cookieHeader,
      identity.forwardedFor,
      identity.realIp,
      identity.requestIp,
      undefined,
    );
    const unsafeResponse = await unsafe.controller.createOrder(
      ozonOrderRequest,
      identity.cookieHeader,
      identity.forwardedFor,
      identity.realIp,
      identity.requestIp,
      undefined,
    );

    assert.deepEqual(externalResponse, {
      itemsCount: 3,
      orderId: "private-order-id",
      redirectUrl: "https://pay.test/redirect",
      revenue: 2_897,
    } satisfies CreateOrderResponseDTO);
    assert.deepEqual(initializingResponse, {
      itemsCount: 3,
      orderId: "private-order-id",
      redirectUrl: null,
      revenue: 2_897,
    } satisfies CreateOrderResponseDTO);
    assert.deepEqual(unsafeResponse, {
      itemsCount: 3,
      orderId: "unsafe-order-id",
      redirectUrl: null,
      revenue: 2_897,
    } satisfies CreateOrderResponseDTO);
  });

  it("exports one shared throttle provider without registering another in OrdersModule", () => {
    const deliveryProviders = getModuleMetadata(
      DeliveryModule,
      MODULE_METADATA.PROVIDERS,
    );
    const deliveryExports = getModuleMetadata(
      DeliveryModule,
      MODULE_METADATA.EXPORTS,
    );
    const orderImports = getModuleMetadata(
      OrdersModule,
      MODULE_METADATA.IMPORTS,
    );
    const orderProviders = getModuleMetadata(
      OrdersModule,
      MODULE_METADATA.PROVIDERS,
    );

    assert.equal(
      deliveryProviders.filter(
        (provider) => provider === DeliveryProxyThrottleService,
      ).length,
      1,
    );
    assert.equal(deliveryExports.includes(DeliveryProxyThrottleService), true);
    assert.equal(orderImports.includes(DeliveryModule), true);
    assert.equal(orderProviders.includes(DeliveryProxyThrottleService), false);
  });
});

function createFixture(
  throttleError?: HttpException,
  authenticatedUser = user,
  createResult: unknown = {
    discount: 0,
    id: "order-1",
    itemsCount: 1,
    payment: { redirectUrl: "https://pay.test/redirect" },
    subtotal: 1_000,
  },
) {
  const events: string[] = [];
  const throttleCalls: unknown[] = [];
  let calculateCheckoutCalls = 0;
  let createOrderCalls = 0;
  const createOrderUsers: Array<AuthUser | undefined> = [];
  const checkoutThrottleCalls: unknown[] = [];
  const recoveryCalls: unknown[] = [];
  const ordersService = {
    calculateCheckout: async () => {
      events.push("calculateCheckout");
      calculateCheckoutCalls += 1;

      return {};
    },
    createOrder: async (_cartId: unknown, _request: unknown, authUser: AuthUser | undefined) => {
      events.push("createOrder");
      createOrderCalls += 1;
      createOrderUsers.push(authUser);

      return createResult;
    },
    recoverPayment: async (orderId: string, cartId: string | undefined) => {
      recoveryCalls.push({ cartId, orderId });
      return { redirectUrl: "https://pay.test/recovery" };
    },
  } as unknown as OrdersService;
  const usersService = {} as UsersService;
  const throttle = {
    assertAllowed: (input: unknown) => {
      events.push("throttle");
      throttleCalls.push(input);

      if (throttleError) {
        throw throttleError;
      }
    },
  } as DeliveryProxyThrottleService;
  const controller = Reflect.construct(OrdersController, [
    ordersService,
    usersService,
    throttle,
    {
      getTokenFromRequest: () => undefined,
      verifyAccessToken: async () => authenticatedUser,
    } as unknown as AuthService,
    {
      assertAllowed: async (input: unknown) => {
        checkoutThrottleCalls.push(input);
      },
    } as unknown as CheckoutThrottleService,
  ]) as unknown as ProtectedOrdersController;

  return {
    get calculateCheckoutCalls() {
      return calculateCheckoutCalls;
    },
    controller,
    checkoutThrottleCalls,
    createOrderUsers,
    events,
    recoveryCalls,
    get createOrderCalls() {
      return createOrderCalls;
    },
    throttleCalls,
  };
}

function getGuards(method: string): unknown[] {
  const descriptor = Object.getOwnPropertyDescriptor(
    OrdersController.prototype,
    method,
  );
  return (
    (Reflect.getMetadata(GUARDS_METADATA, descriptor?.value) as
      | unknown[]
      | undefined) ?? []
  );
}

function getModuleMetadata(module: object, metadataKey: string): unknown[] {
  return (
    (Reflect.getMetadata(metadataKey, module) as unknown[] | undefined) ?? []
  );
}
