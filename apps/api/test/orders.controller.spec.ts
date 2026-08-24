import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HttpException, HttpStatus } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants";

import type { AuthUser } from "../src/auth/auth.types";
import { DeliveryModule } from "../src/delivery/delivery.module";
import { DeliveryProxyThrottleService } from "../src/delivery/delivery-proxy-throttle.service";
import type {
  CalculateCheckoutRequestDTO,
  CreateOrderRequestDTO,
} from "../src/orders/dto";
import { OrdersController } from "../src/orders/orders.controller";
import { OrdersModule } from "../src/orders/orders.module";
import type { OrdersService } from "../src/orders/orders.service";
import type { UsersService } from "../src/users/users.service";

type ProtectedOrdersController = {
  calculateCheckout(
    request: CalculateCheckoutRequestDTO,
    cookieHeader: string | undefined,
    forwardedFor: string | undefined,
    realIp: string | undefined,
    requestIp: string | undefined,
  ): unknown;
  createOrder(
    request: CreateOrderRequestDTO,
    cookieHeader: string | undefined,
    authRequest: { user: AuthUser },
    forwardedFor: string | undefined,
    realIp: string | undefined,
    requestIp: string | undefined,
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
  customer: {
    email: "customer@example.com",
    name: "Customer",
    phone: "+79990000000",
  },
  delivery: { pickupPointId: "ozon-1", provider: "ozon" as const },
  payment: { method: "bank_card_mock" as const },
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
    );

    assert.deepEqual(fixture.events, ["throttle", "calculateCheckout"]);
    assert.deepEqual(fixture.throttleCalls, [identity]);
  });

  it("throttles Ozon order creation exactly once before OrdersService", async () => {
    const fixture = createFixture();

    await fixture.controller.createOrder(
      ozonOrderRequest,
      identity.cookieHeader,
      { user },
      identity.forwardedFor,
      identity.realIp,
      identity.requestIp,
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
        ),
      (error) => error === throttleError,
    );
    await assert.rejects(
      fixture.controller.createOrder(
        ozonOrderRequest,
        identity.cookieHeader,
        { user },
        identity.forwardedFor,
        identity.realIp,
        identity.requestIp,
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
    );
    await fixture.controller.createOrder(
      { ...ozonOrderRequest, delivery: cdekDelivery },
      identity.cookieHeader,
      { user },
      identity.forwardedFor,
      identity.realIp,
      identity.requestIp,
    );

    assert.deepEqual(fixture.events, ["calculateCheckout", "createOrder"]);
    assert.deepEqual(fixture.throttleCalls, []);
  });

  it("exports one shared throttle provider without registering another in OrdersModule", () => {
    const deliveryProviders = getModuleMetadata(DeliveryModule, MODULE_METADATA.PROVIDERS);
    const deliveryExports = getModuleMetadata(DeliveryModule, MODULE_METADATA.EXPORTS);
    const orderImports = getModuleMetadata(OrdersModule, MODULE_METADATA.IMPORTS);
    const orderProviders = getModuleMetadata(OrdersModule, MODULE_METADATA.PROVIDERS);

    assert.equal(
      deliveryProviders.filter((provider) => provider === DeliveryProxyThrottleService).length,
      1,
    );
    assert.equal(deliveryExports.includes(DeliveryProxyThrottleService), true);
    assert.equal(orderImports.includes(DeliveryModule), true);
    assert.equal(orderProviders.includes(DeliveryProxyThrottleService), false);
  });
});

function createFixture(throttleError?: HttpException) {
  const events: string[] = [];
  const throttleCalls: unknown[] = [];
  let calculateCheckoutCalls = 0;
  let createOrderCalls = 0;
  const ordersService = {
    calculateCheckout: async () => {
      events.push("calculateCheckout");
      calculateCheckoutCalls += 1;

      return {};
    },
    createOrder: async () => {
      events.push("createOrder");
      createOrderCalls += 1;

      return {};
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
  ]) as ProtectedOrdersController;

  return {
    get calculateCheckoutCalls() {
      return calculateCheckoutCalls;
    },
    controller,
    events,
    get createOrderCalls() {
      return createOrderCalls;
    },
    throttleCalls,
  };
}

function getModuleMetadata(module: object, metadataKey: string): unknown[] {
  return (Reflect.getMetadata(metadataKey, module) as unknown[] | undefined) ?? [];
}
