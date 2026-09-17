import "reflect-metadata";

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";

import { OrderPaymentStatus, Prisma } from "../src/generated/prisma/client";
import { CheckoutThrottleService } from "../src/orders/checkout-throttle.service";
import { CartStorage } from "../src/cart/cart.storage";
import { CreateOrderRequestDTO } from "../src/orders/dto";
import { OrdersService } from "../src/orders/orders.service";
import { OrdersStorage } from "../src/orders/orders.storage";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { OrderActivationService } from "../src/auth/order-activation.service";
import type { AnalyticsOutboxService } from "../src/analytics/analytics-outbox.service";
import type { AffiliateFinancialAccountingService } from "../src/affiliate/financial-accounting.service";

const request = {
  acceptedLegal: true,
  acceptedPersonalDataConsent: true,
  attribution: { clientId: "123456", yclid: "987654" },
  checkoutAttemptId: "opaque-attempt-1",
  customer: {
    email: "guest@example.com",
    name: "Анна Иванова",
    phone: "+7 (999) 123-45-67",
  },
  delivery: { provider: "cdek" as const, pickupPointId: "point-1" },
  payment: { method: "tbank_acquiring" as const },
};

describe("guest checkout", () => {
  it("accepts an opaque attempt key and exact recipient customer data", async () => {
    const dto = plainToInstance(CreateOrderRequestDTO, request);

    assert.deepEqual(await validate(dto), []);

    const missingAttempt = plainToInstance(CreateOrderRequestDTO, {
      ...request,
      checkoutAttemptId: undefined,
    });
    assert.equal((await validate(missingAttempt)).length > 0, true);
  });

  it("validates Russian recipient names and required exact phones at the DTO boundary", async () => {
    for (const name of [
      "Анна Иванова",
      "Анна-Мария",
      "Ёлкина",
      "А".repeat(120),
    ]) {
      assert.deepEqual(
        await validate(
          plainToInstance(CreateOrderRequestDTO, {
            ...request,
            customer: { ...request.customer, name },
          }),
        ),
        [],
        name,
      );
    }

    for (const name of [
      "Anna",
      "Анна2",
      "Анна_Мария",
      "Анна  Мария",
      "-Анна",
      "Анна-",
      "А".repeat(121),
    ]) {
      assert.notDeepEqual(
        await validate(
          plainToInstance(CreateOrderRequestDTO, {
            ...request,
            customer: { ...request.customer, name },
          }),
        ),
        [],
        name,
      );
    }

    for (const phone of [
      undefined,
      null,
      "",
      "+7 (999) 123-45",
      "+7 (ABC) 123-45-67",
      "+1 (999) 123-45-67",
    ]) {
      assert.notDeepEqual(
        await validate(
          plainToInstance(CreateOrderRequestDTO, {
            ...request,
            customer: { ...request.customer, phone },
          }),
        ),
        [],
        String(phone),
      );
    }
  });

  it("accepts checkout email up to 254 characters at the DTO boundary", async () => {
    const maximumEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
    const oversizedEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}`;

    assert.equal(maximumEmail.length, 254);
    assert.equal(oversizedEmail.length, 255);
    assert.deepEqual(
      await validate(
        plainToInstance(CreateOrderRequestDTO, {
          ...request,
          customer: { ...request.customer, email: maximumEmail },
        }),
      ),
      [],
    );
    assert.notDeepEqual(
      await validate(
        plainToInstance(CreateOrderRequestDTO, {
          ...request,
          customer: { ...request.customer, email: oversizedEmail },
        }),
      ),
      [],
    );
  });

  it("enforces recipient name and phone on direct service calls without ValidationPipe", async () => {
    for (const customer of [
      { ...request.customer, phone: undefined },
      { ...request.customer, phone: null },
      { ...request.customer, phone: "" },
      { ...request.customer, phone: "+7 (999) 123-45" },
      { ...request.customer, phone: "+7 (ABC) 123-45-67" },
      { ...request.customer, phone: "+1 (999) 123-45-67" },
      { ...request.customer, name: "Anna" },
      { ...request.customer, name: "Анна  Иванова" },
      { ...request.customer, name: "А".repeat(121) },
    ]) {
      const fixture = createServiceFixture();
      await assert.rejects(
        fixture.service.createOrder("cart-1", {
          ...request,
          customer,
        } as never),
        BadRequestException,
      );
      assert.equal(fixture.createInputs.length, 0);
    }
  });

  it("enforces the 254-character email limit before order mutation on direct service calls", async () => {
    const maximumEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
    const oversizedEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}`;
    const accepted = createServiceFixture();
    const rejected = createServiceFixture();

    await accepted.service.createOrder(
      "cart-1",
      { ...request, customer: { ...request.customer, email: maximumEmail } },
      undefined,
    );
    await assert.rejects(
      rejected.service.createOrder(
        "cart-1",
        {
          ...request,
          customer: { ...request.customer, email: oversizedEmail },
        },
        undefined,
      ),
      BadRequestException,
    );

    assert.equal(accepted.createInputs.length, 1);
    assert.equal(rejected.getCartCalls(), 0);
    assert.equal(rejected.createInputs.length, 0);
  });

  it("creates and provisions an unauthenticated order before bank initialization", async () => {
    const fixture = createServiceFixture();

    const order = await fixture.service.createOrder(
      "cart-1",
      request,
      undefined,
    );

    assert.equal(order.id, "order-1");
    assert.equal(fixture.createInputs.length, 1);
    assert.equal(fixture.createInputs[0]?.userId, undefined);
    assert.equal(
      fixture.createInputs[0]?.checkoutAttemptId,
      "opaque-attempt-1",
    );
    assert.deepEqual(fixture.createInputs[0]?.attribution, request.attribution);
    assert.deepEqual(fixture.createInputs[0]?.customer, request.customer);
    assert.deepEqual(fixture.events.slice(0, 2), [
      "create-order",
      "initialize-payment",
    ]);
  });

  it("drops invalid attribution on direct service calls", async () => {
    const fixture = createServiceFixture();

    await fixture.service.createOrder(
      "cart-1",
      { ...request, attribution: { clientId: "123.456", yclid: "yclid-1" } },
      undefined,
    );

    assert.deepEqual(fixture.createInputs[0]?.attribution, {});
  });

  it("rejects mock payment before mutations for guests and authenticated users", async () => {
    for (const authUser of [
      undefined,
      {
        id: "user-1",
        provider: "credentials" as const,
        providerUserId: "user-1",
        roles: [],
      },
    ]) {
      const fixture = createServiceFixture();

      await assert.rejects(
        fixture.service.createOrder(
          "cart-1",
          { ...request, payment: { method: "bank_card_mock" } } as never,
          authUser,
        ),
        (error: unknown) =>
          error instanceof BadRequestException && error.getStatus() === 400,
      );
      assert.equal(fixture.getCartCalls(), 0);
      assert.equal(fixture.createInputs.length, 0);
    }
  });

  it("returns an existing equivalent attempt before reading a cleared cart", async () => {
    const fixture = createServiceFixture({
      existingOrder: createOrderDTO(),
    });

    const order = await fixture.service.createOrder(
      "cart-1",
      request,
      undefined,
    );

    assert.equal(order.id, "order-1");
    assert.equal(fixture.getCartCalls(), 0);
    assert.equal(fixture.createInputs.length, 0);
  });

  it("resumes provider initialization once for concurrent equivalent attempts", async () => {
    const fixture = createServiceFixture({
      existingOrder: createOrderDTO({
        redirectUrl: "/checkout/success?orderId=order-1",
      }),
      coordinatePaymentInitialization: true,
    });

    const [first, second] = await Promise.all([
      fixture.service.createOrder("cart-1", request, undefined),
      fixture.service.createOrder("cart-1", request, undefined),
    ]);

    assert.equal(first.id, second.id);
    assert.equal(fixture.providerCalls(), 1);
    assert.equal(first.payment.redirectUrl, "https://pay.test");
    assert.equal(second.payment.redirectUrl, "https://pay.test");
  });

  it("fingerprints the canonical normalized create payload", async () => {
    const first = createServiceFixture();
    const equivalent = createServiceFixture();
    const changed = createServiceFixture();
    const authUser = {
      id: "user-1",
      provider: "credentials" as const,
      providerUserId: "user-1",
      roles: [],
    };

    await first.service.createOrder(
      "cart-1",
      {
        ...request,
        attribution: undefined,
        customer: { ...request.customer, name: " Анна Иванова " },
        payment: { method: "tbank_acquiring" },
      },
      authUser,
    );
    await equivalent.service.createOrder(
      "cart-1",
      {
        ...request,
        attribution: { clientId: "111111", yclid: "222222" },
        customer: { ...request.customer, name: "Анна Иванова" },
        payment: { method: "tbank_acquiring" },
      },
      authUser,
    );
    await changed.service.createOrder(
      "cart-1",
      {
        ...request,
        customer: { ...request.customer, phone: "+7 (999) 123-45-68" },
        payment: { method: "tbank_acquiring" },
      },
      authUser,
    );

    const firstHash = first.createInputs[0]?.checkoutPayloadFingerprint;
    const equivalentHash =
      equivalent.createInputs[0]?.checkoutPayloadFingerprint;
    const changedHash = changed.createInputs[0]?.checkoutPayloadFingerprint;
    assert.match(String(firstHash), /^[a-f0-9]{64}$/);
    assert.equal(firstHash, equivalentHash);
    assert.notEqual(firstHash, changedHash);
    assert.equal(
      first.createInputs[0]?.customer &&
        (first.createInputs[0].customer as { phone: string }).phone,
      "+7 (999) 123-45-67",
    );
  });
});

describe("CDEK shipment customer phone", () => {
  it("passes a required checkout phone to the CDEK delivery service", async () => {
    const deliveryInputs: Array<{ customer: { phone: string } }> = [];
    const service = createCdekShipmentServiceFixture({ deliveryInputs });
    const ensureShipment = (
      service as unknown as {
        ensureCdekShipmentForPaidOrder: (
          order: ReturnType<typeof createOrderDTO>,
        ) => Promise<unknown>;
      }
    ).ensureCdekShipmentForPaidOrder.bind(service);

    await ensureShipment(createOrderDTO());

    assert.equal(deliveryInputs[0]?.customer.phone, "+7 (999) 123-45-67");
  });

  it("records an error shipment for a legacy CDEK order without a phone instead of silently skipping", async () => {
    const shipmentWrites: Array<Record<string, unknown>> = [];
    const service = createCdekShipmentServiceFixture({ shipmentWrites });
    const ensureShipment = (
      service as unknown as {
        ensureCdekShipmentForPaidOrder: (
          order: ReturnType<typeof createOrderDTO>,
        ) => Promise<unknown>;
      }
    ).ensureCdekShipmentForPaidOrder.bind(service);
    const order = {
      ...createOrderDTO(),
      customer: { email: "legacy@example.com", name: "Анна Иванова" },
    } as unknown as ReturnType<typeof createOrderDTO>;

    await ensureShipment(order);

    assert.equal(shipmentWrites.length, 1);
    assert.equal(shipmentWrites[0]?.requestState, "ERROR");
    assert.match(String(shipmentWrites[0]?.errorMessage), /customer phone/u);
  });
});

describe("OrdersStorage checkout idempotency", () => {
  it("locks reciprocal authenticated and guest buyers in the same order before order FKs", async () => {
    for (const { authenticated, buyerId, ownerId } of [
      { authenticated: true, buyerId: "user-a", ownerId: "user-b" },
      { authenticated: true, buyerId: "user-b", ownerId: "user-a" },
      { authenticated: false, buyerId: "user-a", ownerId: "user-b" },
      { authenticated: false, buyerId: "user-b", ownerId: "user-a" },
    ]) {
      const calls: string[] = [];
      const fixture = createStorageFixture(
        {
          getAffiliateOwnerUserId: async () => ownerId,
          reserveInTransaction: async () => ({
            pricingSnapshot: {
              subtotalKopecks: 100_000,
              discountKopecks: 0,
              totalKopecks: 100_000,
              items: [
                {
                  priceGroups: [{ quantity: 1, unitPriceKopecks: 100_000 }],
                },
              ],
            },
          }),
        } as never,
        {
          existingUserIds: authenticated ? [buyerId] : [],
          guestUserId: authenticated ? undefined : buyerId,
          lockCalls: calls,
        },
      );

      await fixture.storage.createOrder({
        ...createStoredOrderInput(),
        promoCode: "AFFILIATE",
        userId: authenticated ? buyerId : undefined,
      });

      assert.deepEqual(calls, ["lock:user-a,user-b", "order.create"]);
    }
  });

  it("does not add user pre-locks for standard or welcome promo paths", async () => {
    for (const promoCode of ["STANDARD", "WELCOME"]) {
      const calls: string[] = [];
      const fixture = createStorageFixture(
        {
          getAffiliateOwnerUserId: async () => undefined,
          reserveInTransaction: async () => ({
            pricingSnapshot: {
              subtotalKopecks: 100_000,
              discountKopecks: 0,
              totalKopecks: 100_000,
              items: [
                {
                  priceGroups: [{ quantity: 1, unitPriceKopecks: 100_000 }],
                },
              ],
            },
          }),
        } as never,
        { lockCalls: calls },
      );

      await fixture.storage.createOrder({
        ...createStoredOrderInput(),
        checkoutAttemptId: `attempt-${promoCode}`,
        promoCode,
      });
      assert.deepEqual(calls, ["order.create"]);
    }
  });

  it("attaches the guest before reserving without granting authenticated promo identity", async () => {
    const reservationFailure = new Error("Intentional promo failure");
    const fixture = createStorageFixture({
      reserveInTransaction: async (
        _tx: unknown,
        input: { userId?: string },
      ) => {
        assert.equal(fixture.activationCount(), 1);
        assert.equal(fixture.orders[0]?.userId, "guest-user");
        assert.equal(input.userId, undefined);
        throw reservationFailure;
      },
    } as never);

    await assert.rejects(
      fixture.storage.createOrder({
        ...createStoredOrderInput(),
        promoCode: "TEST",
      }),
      (error) => error === reservationFailure,
    );
    assert.equal(fixture.orders.length, 0);
    assert.equal(fixture.createdEvents.length, 0);
    assert.equal(fixture.activationCount(), 0);
  });

  it("prelinks a guest and returns one order for concurrent equivalent attempts", async () => {
    const fixture = createStorageFixture();
    const input = createStoredOrderInput();

    const [first, second] = await Promise.all([
      fixture.storage.createOrder(input),
      fixture.storage.createOrder(input),
    ]);

    assert.equal(first.id, second.id);
    assert.equal(fixture.orders.length, 1);
    assert.equal(fixture.orders[0]?.checkoutActorUserId, null);
    assert.equal(fixture.orders[0]?.userId, "guest-user");
    assert.equal(fixture.activationCount(), 1);
    assert.equal(fixture.orders[0]?.yandexClientId, "123456");
    assert.equal(fixture.orders[0]?.yandexYclid, "987654");
    assert.equal(fixture.orders[0]?.customerPhone, "+7 (999) 123-45-67");
    assert.equal(fixture.createdEvents.length, 1);
    assert.equal(fixture.createdEvents[0]?.id, first.id);
  });

  it("enqueues the persisted creation snapshot after promo pricing in the same transaction", async () => {
    const fixture = createStorageFixture({
      reserveInTransaction: async () => {
        assert.equal(fixture.createdEvents.length, 0);
        const stored = fixture.orders[0];
        assert.ok(stored);
        stored.discount = 100;
        stored.total = 1_000;
        return {
          pricingSnapshot: {
            subtotalKopecks: 100_000,
            discountKopecks: 10_000,
            totalKopecks: 90_000,
            items: [
              { priceGroups: [{ quantity: 1, unitPriceKopecks: 90_000 }] },
            ],
          },
        };
      },
    } as never);

    const order = await fixture.storage.createOrder({
      ...createStoredOrderInput(),
      promoCode: "TEST",
    });

    assert.deepEqual(fixture.createdEvents, [
      {
        id: order.id,
        createdAt: new Date("2026-09-08T12:49:58.000Z"),
        subtotal: 1_000,
        discount: 100,
        yandexClientId: "123456",
        yandexYclid: "987654",
      },
    ]);
  });

  it("rolls back the order and guest attachment if creation outbox persistence fails", async () => {
    const enqueueFailure = new Error("Intentional outbox persistence failure");
    const fixture = createStorageFixture(undefined, { enqueueFailure });

    await assert.rejects(
      fixture.storage.createOrder(createStoredOrderInput()),
      (error) => error === enqueueFailure,
    );

    assert.equal(fixture.orders.length, 0);
    assert.equal(fixture.activationCount(), 0);
    assert.equal(fixture.createdEvents.length, 0);
  });

  it("rolls back the creation outbox alongside the order if its transaction cannot commit", async () => {
    const commitFailure = new Error("Intentional transaction commit failure");
    const fixture = createStorageFixture(undefined, { commitFailure });

    await assert.rejects(
      fixture.storage.createOrder(createStoredOrderInput()),
      (error) => error === commitFailure,
    );

    assert.equal(fixture.orders.length, 0);
    assert.equal(fixture.activationCount(), 0);
    assert.equal(fixture.createdEvents.length, 0);
    assert.equal(fixture.enqueueAttempts(), 1);
  });

  it("drops invalid attribution on direct storage calls", async () => {
    const fixture = createStorageFixture();

    await fixture.storage.createOrder({
      ...createStoredOrderInput(),
      attribution: { clientId: "123.456", yclid: "yclid-1" },
    });

    assert.equal(fixture.orders[0]?.yandexClientId, undefined);
    assert.equal(fixture.orders[0]?.yandexYclid, undefined);
  });

  it("rejects attempt reuse by another cart or checkout actor", async () => {
    const fixture = createStorageFixture();
    await fixture.storage.createOrder(createStoredOrderInput());

    await assert.rejects(
      fixture.storage.createOrder({
        ...createStoredOrderInput(),
        cartId: "cart-2",
      }),
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === 409,
    );
    await assert.rejects(
      fixture.storage.createOrder({
        ...createStoredOrderInput(),
        userId: "user-2",
      }),
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === 409,
    );
  });

  it("keeps a guest retry idempotent after assigning the owner userId", async () => {
    const fixture = createStorageFixture();
    const first = await fixture.storage.createOrder(createStoredOrderInput());
    const second = await fixture.storage.createOrder(createStoredOrderInput());

    assert.equal(first.id, second.id);
    assert.equal(fixture.orders.length, 1);
    assert.equal(fixture.orders[0]?.checkoutActorUserId, null);
    assert.equal(fixture.orders[0]?.userId, "guest-user");
    assert.equal(fixture.activationCount(), 1);
    assert.equal(fixture.createdEvents.length, 1);
  });

  it("rejects concurrent attempt reuse with a different payload fingerprint", async () => {
    const fixture = createStorageFixture();
    await fixture.storage.createOrder(createStoredOrderInput());

    await assert.rejects(
      fixture.storage.createOrder({
        ...createStoredOrderInput(),
        checkoutPayloadFingerprint: "b".repeat(64),
      }),
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === 409,
    );
    assert.equal(fixture.orders.length, 1);
  });

  it("stops waiting when a provider initialization has failed", async () => {
    let reads = 0;
    const failedOrder = {
      id: "order-1",
      paymentRedirectUrl:
        "/checkout/payment-initializing?startedAt=1788640000000",
      paymentStatus: OrderPaymentStatus.FAILED,
    };
    const storage = new OrdersStorage(
      {
        order: {
          findUnique: async () => {
            reads += 1;
            return failedOrder;
          },
        },
      } as unknown as PrismaService,
      {} as never,
      ...createUnusedStorageDependencies(),
    );
    (storage as unknown as { mapOrder: (value: unknown) => unknown }).mapOrder =
      (value) => value;

    const result = await storage.waitForPaymentInitialization("order-1");

    assert.equal(result, failedOrder);
    assert.equal(reads, 1);
  });

  it("immediately reclaims a failed provider initialization marker", async () => {
    const updates: unknown[] = [];
    const failedOrder = {
      id: "order-1",
      paymentRedirectUrl: `/checkout/payment-initializing?startedAt=${Date.now()}`,
      paymentStatus: OrderPaymentStatus.FAILED,
    };
    const tx = {
      $queryRaw: async () => [],
      order: {
        findUnique: async () => failedOrder,
        update: async (input: unknown) => {
          updates.push(input);
          return failedOrder;
        },
      },
    };
    const storage = new OrdersStorage(
      {
        $transaction: async (
          operation: (client: unknown) => Promise<unknown>,
        ) => operation(tx),
      } as unknown as PrismaService,
      {} as never,
      ...createUnusedStorageDependencies(),
    );

    assert.equal(await storage.claimPaymentInitialization("order-1"), true);
    assert.equal(updates.length, 1);
  });

  it("never reclaims a verified terminal payment failure", async () => {
    const updates: unknown[] = [];
    const failedOrder = {
      id: "order-1",
      paymentRedirectUrl: "/checkout/failure",
      paymentStatus: OrderPaymentStatus.FAILED,
      terminalPaymentFailedAt: new Date(),
    };
    const tx = {
      $queryRaw: async () => [],
      order: {
        findUnique: async () => failedOrder,
        update: async (input: unknown) => {
          updates.push(input);
          return failedOrder;
        },
      },
    };
    const storage = new OrdersStorage(
      {
        $transaction: async (
          operation: (client: unknown) => Promise<unknown>,
        ) => operation(tx),
      } as unknown as PrismaService,
      {} as never,
      ...createUnusedStorageDependencies(),
    );

    assert.equal(await storage.claimPaymentInitialization("order-1"), false);
    assert.equal(updates.length, 0);
  });

  it("returns the same generic 404 for a missing cart, foreign cart, and unknown order", async () => {
    const storage = createRecoveryStorage({ cartId: "owner-cart" });

    for (const [orderId, cartId] of [
      ["order-1", undefined],
      ["order-1", "foreign-cart"],
      ["unknown", "owner-cart"],
    ] as const) {
      await assert.rejects(
        storage.recoverGuestPayment(orderId, cartId),
        (error: unknown) =>
          error instanceof NotFoundException &&
          error.message === "Order not found",
      );
    }
  });

  it("checks ownership before returning a neutral paid redirect for an attached guest order", async () => {
    const storage = createRecoveryStorage({
      cartId: "owner-cart",
      paymentStatus: OrderPaymentStatus.PAID,
      userId: "post-paid-user",
      checkoutActorUserId: null,
    });

    assert.deepEqual(
      await storage.recoverGuestPayment("order-1", "owner-cart"),
      { redirectUrl: "/checkout/success" },
    );
    await assert.rejects(
      storage.recoverGuestPayment("order-1", "foreign-cart"),
      NotFoundException,
    );
  });

  it("recovers a prelinked pending guest only for the original cart and rejects auth-origin orders", async () => {
    const guest = createRecoveryStorage({
      cartId: "owner-cart",
      userId: "prelinked-user",
      checkoutActorUserId: null,
    });
    const authenticated = createRecoveryStorage({
      cartId: "owner-cart",
      userId: "authenticated-user",
      checkoutActorUserId: "authenticated-user",
    });
    const paidAuthenticated = createRecoveryStorage({
      cartId: "owner-cart",
      userId: "authenticated-user",
      checkoutActorUserId: "authenticated-user",
      paymentStatus: OrderPaymentStatus.PAID,
    });

    assert.deepEqual(await guest.recoverGuestPayment("order-1", "owner-cart"), {
      redirectUrl: "https://securepay.tinkoff.ru/session",
    });
    await assert.rejects(
      guest.recoverGuestPayment("order-1", "foreign-cart"),
      NotFoundException,
    );
    await assert.rejects(
      authenticated.recoverGuestPayment("order-1", "owner-cart"),
      NotFoundException,
    );
    await assert.rejects(
      paidAuthenticated.recoverGuestPayment("order-1", "owner-cart"),
      NotFoundException,
    );
  });

  it("resumes only a stored HTTPS provider URL and keeps internal initialization neutral", async () => {
    const pending = createRecoveryStorage({
      paymentRedirectUrl: "https://securepay.tinkoff.ru/session",
    });
    const initializing = createRecoveryStorage({
      paymentRedirectUrl: "/checkout/payment-initializing?startedAt=1",
    });
    const unsafe = createRecoveryStorage({
      paymentRedirectUrl: "javascript:alert(1)",
    });

    assert.deepEqual(await pending.recoverGuestPayment("order-1", "cart-1"), {
      redirectUrl: "https://securepay.tinkoff.ru/session",
    });
    assert.deepEqual(
      await initializing.recoverGuestPayment("order-1", "cart-1"),
      { redirectUrl: null },
    );
    assert.deepEqual(await unsafe.recoverGuestPayment("order-1", "cart-1"), {
      redirectUrl: null,
    });
  });

  it("keeps Ozon Rejected and local FAILED payments resumable without restoring the cart", async () => {
    const ozon = createRecoveryStorage({
      paymentMethod: "OZON_ACQUIRING",
      paymentRedirectUrl: "https://pay.ozon.ru/session",
      paymentStatus: OrderPaymentStatus.PENDING,
    });
    const localFailure = createRecoveryStorage({
      paymentRedirectUrl: "/checkout/payment-initializing?startedAt=1",
      paymentStatus: OrderPaymentStatus.FAILED,
      terminalPaymentFailedAt: null,
    });

    assert.deepEqual(await ozon.recoverGuestPayment("order-1", "cart-1"), {
      redirectUrl: "https://pay.ozon.ru/session",
    });
    assert.deepEqual(
      await localFailure.recoverGuestPayment("order-1", "cart-1"),
      { redirectUrl: null },
    );
    assert.equal(localFailure.state.cartRestoredAt, null);
  });

  it("returns the internal in-progress order when the bounded local wait expires", async () => {
    const originalNow = Date.now;
    let now = 1_000;
    let reads = 0;
    const initializingOrder = {
      id: "order-1",
      paymentRedirectUrl: "/checkout/payment-initializing?startedAt=1000",
      paymentStatus: OrderPaymentStatus.PENDING,
    };
    const storage = new OrdersStorage(
      {
        order: {
          findUnique: async () => {
            reads += 1;
            return initializingOrder;
          },
        },
      } as unknown as PrismaService,
      {} as never,
      ...createUnusedStorageDependencies(),
    );
    Date.now = () => now;
    (storage as unknown as { delay: () => Promise<void> }).delay = async () => {
      now += 1_000;
    };
    (storage as unknown as { mapOrder: (value: unknown) => unknown }).mapOrder =
      (value) => value;

    try {
      const result = await storage.waitForPaymentInitialization("order-1");

      assert.equal(result, initializingOrder);
      assert.equal(reads > 0, true);
    } finally {
      Date.now = originalNow;
    }
  });

  it("scopes order detail and lists behaviorally to the authenticated owner", async () => {
    const queries: unknown[] = [];
    const storedOrder = {
      id: "order-1",
      userId: "owner-1",
      checkoutActorUserId: null,
      paymentStatus: OrderPaymentStatus.PENDING,
    };
    const storage = new OrdersStorage(
      {
        order: {
          findFirst: async (input: {
            where: { id: string; userId: string };
          }) => {
            queries.push(input);
            return input.where.userId === storedOrder.userId
              ? storedOrder
              : null;
          },
          findMany: async (input: { where: { userId: string } }) => {
            queries.push(input);
            return input.where.userId === storedOrder.userId
              ? [storedOrder]
              : [];
          },
        },
      } as unknown as PrismaService,
      {} as never,
      ...createUnusedStorageDependencies(),
    );
    (storage as unknown as { mapOrder: (value: unknown) => unknown }).mapOrder =
      (value) => value;

    assert.equal(await storage.getOrder("order-1", "owner-1"), storedOrder);
    await assert.rejects(
      storage.getOrder("order-1", "other-user"),
      /Order not found/,
    );
    assert.deepEqual(await storage.getOrdersByUserId("owner-1"), [storedOrder]);
    assert.deepEqual(await storage.getOrdersByUserId("other-user"), []);
    assert.deepEqual(
      queries.map((query) => (query as { where: unknown }).where),
      [
        { id: "order-1", userId: "owner-1" },
        { id: "order-1", userId: "other-user" },
        { userId: "owner-1" },
        { userId: "other-user" },
      ],
    );
  });
});

describe("CheckoutThrottleService", () => {
  it("persists hashed cart/IP subjects across service instances", async () => {
    const previousSecret = process.env.AUTH_JWT_SECRET;
    try {
      process.env.AUTH_JWT_SECRET = "checkout-test-secret";
      const prisma = createThrottlePrisma();
      const first = new CheckoutThrottleService(
        prisma as unknown as PrismaService,
      );
      const second = new CheckoutThrottleService(
        prisma as unknown as PrismaService,
      );
      const identity = {
        cartId: "secret-cart-id",
        forwardedFor: undefined,
        realIp: undefined,
        requestIp: "203.0.113.25",
      };

      for (let index = 0; index < 5; index += 1) {
        await first.assertAllowed(identity);
      }

      await assert.rejects(
        second.assertAllowed(identity),
        (error: unknown) =>
          error instanceof HttpException &&
          error.getStatus() === HttpStatus.TOO_MANY_REQUESTS,
      );
      assert.equal(prisma.rows.size, 2);
      for (const row of prisma.rows.values()) {
        assert.match(row.subjectHash, /^[a-f0-9]{64}$/);
        assert.equal(row.subjectHash.includes("secret-cart-id"), false);
        assert.equal(row.subjectHash.includes("203.0.113.25"), false);
      }
    } finally {
      if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET;
      else process.env.AUTH_JWT_SECRET = previousSecret;
    }
  });

  it("uses a keyed HMAC and fails closed without the server secret", async () => {
    const previousSecret = process.env.AUTH_JWT_SECRET;
    try {
      process.env.AUTH_JWT_SECRET = "checkout-test-secret";
      const prisma = createThrottlePrisma();
      const service = new CheckoutThrottleService(
        prisma as unknown as PrismaService,
      );
      await service.assertAllowed({
        cartId: "secret-cart-id",
        requestIp: "203.0.113.25",
      });

      const expectedCartHash = crypto
        .createHmac("sha256", "checkout-test-secret")
        .update("checkout-throttle:cart:secret-cart-id")
        .digest("hex");
      assert.equal(
        [...prisma.rows.values()].some(
          (row) => row.subjectHash === expectedCartHash,
        ),
        true,
      );

      delete process.env.AUTH_JWT_SECRET;
      await assert.rejects(
        new CheckoutThrottleService(
          createThrottlePrisma() as unknown as PrismaService,
        ).assertAllowed({ cartId: "cart-2" }),
        /AUTH_JWT_SECRET is not configured/,
      );
    } finally {
      if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET;
      else process.env.AUTH_JWT_SECRET = previousSecret;
    }
  });
});

describe("CartStorage payment recovery serialization", () => {
  it("locks the cart row inside the same transaction before reading or mutating items", async () => {
    const events: string[] = [];
    const cart = { id: "cart-1", items: [] };
    const tx = {
      $queryRaw: async () => {
        events.push("lock");
        return [];
      },
      cart: {
        update: async () => cart,
      },
      cartItem: {
        findUnique: async () => {
          events.push("read-item");
          return null;
        },
        upsert: async () => {
          events.push("write-item");
        },
      },
    };
    const storage = new CartStorage({
      cart: { upsert: async () => cart },
      $transaction: async (operation: (client: unknown) => Promise<unknown>) =>
        operation(tx),
    } as unknown as PrismaService);

    await storage.addItem(
      "cart-1",
      {
        id: "product-1",
        image: "/product.jpg",
        price: 100,
        slug: "product",
        title: "Product",
      },
      1,
      99,
    );

    assert.deepEqual(events, ["lock", "read-item", "write-item"]);
  });
});

function createServiceFixture(
  options: {
    coordinatePaymentInitialization?: boolean;
    existingOrder?: ReturnType<typeof createOrderDTO>;
  } = {},
) {
  const createInputs: Array<Record<string, unknown>> = [];
  const events: string[] = [];
  let getCartCalls = 0;
  let providerCalls = 0;
  let paymentClaimed = false;
  let resolvePayment: (() => void) | undefined;
  const paymentAttached = new Promise<void>((resolve) => {
    resolvePayment = resolve;
  });
  const service = Object.assign(Object.create(OrdersService.prototype), {
    cartService: {
      getCart: async () => {
        getCartCalls += 1;
        return {
          id: "cart-1",
          items: [
            {
              id: "product-1",
              image: "/product.jpg",
              lineTotal: 1000,
              price: 1000,
              quantity: 1,
              slug: "product-1",
              title: "Product",
            },
          ],
          itemsCount: 1,
          subtotal: 1000,
          total: 1000,
          currency: "RUB",
          isOzonDeliveryAvailable: true,
        };
      },
      assertItemsInStock: async () => undefined,
      clearCart: async () => undefined,
    },
    deliveryService: {
      calculatePickupPointDelivery: async () => ({
        provider: "cdek",
        deliveryPrice: 100,
        pickupPoint: {
          id: "point-1",
          title: "Point",
          address: "Address",
          workHours: "09:00-21:00",
          deliveryPrice: 100,
        },
      }),
    },
    productShippingService: {
      resolveForProducts: async (ids: string[]) =>
        new Map(
          ids.map((id) => [
            id,
            {
              id: "shipping_album",
              code: "album",
              weightGrams: 400,
              lengthCm: 40,
              widthCm: 30,
              heightCm: 1,
            },
          ]),
        ),
    },
    ordersStorage: {
      getOrderByCheckoutAttempt: async () => options.existingOrder,
      claimPaymentInitialization: async () => {
        if (!options.coordinatePaymentInitialization || !paymentClaimed) {
          paymentClaimed = true;
          return true;
        }
        return false;
      },
      waitForPaymentInitialization: async () => {
        await paymentAttached;
        return createOrderDTO();
      },
      createOrder: async (input: Record<string, unknown>) => {
        events.push("create-order");
        createInputs.push(input);
        return createOrderDTO();
      },
      getOrderReceiptPricing: async () => undefined,
      attachTBankAcquiringPayment: async () => {
        resolvePayment?.();
        return createOrderDTO();
      },
      consumeOrderCartSnapshot: async () => undefined,
    },
    promocodesService: {},
    tbankAcquiringService: {
      createCheckoutPayment: async () => {
        events.push("initialize-payment");
        providerCalls += 1;
        return { redirectUrl: "https://pay.test" };
      },
    },
    runPaymentSideEffect: async (
      _description: string,
      effect: () => Promise<unknown>,
    ) => effect(),
    queueOrderCreatedNotifications: async () => undefined,
  }) as OrdersService;

  return {
    createInputs,
    events,
    getCartCalls: () => getCartCalls,
    providerCalls: () => providerCalls,
    service,
  };
}

function createCdekShipmentServiceFixture({
  deliveryInputs = [],
  shipmentWrites = [],
}: {
  deliveryInputs?: Array<{ customer: { phone: string } }>;
  shipmentWrites?: Array<Record<string, unknown>>;
}) {
  return Object.assign(Object.create(OrdersService.prototype), {
    deliveryService: {
      createCdekOrder: async (input: { customer: { phone: string } }) => {
        deliveryInputs.push(input);
        return { requestState: "ACCEPTED", responsePayload: {} };
      },
    },
    isCdekOrderCreationEnabled: () => true,
    logger: { warn: () => undefined },
    ordersStorage: {
      claimOrderShipmentCreation: async () => ({
        shouldCreate: true,
        shipment: { provider: "cdek" },
      }),
      getCdekShipmentItems: async () => [
        {
          id: "product-1",
          slug: "product-1",
          title: "Product",
          price: 1000,
          quantity: 1,
          lineTotal: 1000,
          shippingPackage: {
            version: 1 as const,
            id: "shipping_album",
            code: "album",
            weightGrams: 400,
            lengthCm: 40,
            widthCm: 30,
            heightCm: 1,
          },
        },
      ],
      upsertOrderShipment: async (input: Record<string, unknown>) => {
        shipmentWrites.push(input);
        return { ...input, createdAt: "", updatedAt: "" };
      },
    },
  }) as OrdersService;
}

function createStoredOrderInput() {
  return {
    cartId: "cart-1",
    checkoutAttemptId: "opaque-attempt-1",
    checkoutPayloadFingerprint: "a".repeat(64),
    attribution: { clientId: "123456", yclid: "987654" },
    customer: {
      email: "guest@example.com",
      name: "Анна Иванова",
      phone: "+7 (999) 123-45-67",
    },
    delivery: {
      provider: "cdek" as const,
      pickupPoint: {
        id: "point-1",
        title: "Point",
        address: "Address",
        workHours: "09:00-21:00",
        deliveryPrice: 100,
      },
    },
    items: [
      {
        id: "product-1",
        image: "/product.jpg",
        lineTotal: 1000,
        price: 1000,
        quantity: 1,
        slug: "product-1",
        title: "Product",
        shippingPackage: {
          version: 1 as const,
          id: "shipping_album",
          code: "album",
          weightGrams: 400,
          lengthCm: 40,
          widthCm: 30,
          heightCm: 1,
        },
      },
    ],
    itemsCount: 1,
    paymentMethod: "tbank_acquiring" as const,
    subtotal: 1000,
    userId: undefined,
  };
}

function createStorageFixture(
  promocodesService: ConstructorParameters<
    typeof OrdersStorage
  >[1] = {} as never,
  options: {
    enqueueFailure?: Error;
    commitFailure?: Error;
    existingUserIds?: string[];
    guestUserId?: string;
    lockCalls?: string[];
  } = {},
) {
  const orders: Array<Record<string, unknown>> = [];
  const createdEvents: Array<Record<string, unknown>> = [];
  let activations = 0;
  let enqueueAttempts = 0;
  let activeTransaction: unknown;
  let transactionTail = Promise.resolve();
  const order = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      options.lockCalls?.push("order.create");
      if (
        orders.some((item) => item.checkoutAttemptId === data.checkoutAttemptId)
      ) {
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          clientVersion: "test",
          code: "P2002",
          meta: { target: ["checkout_attempt_id"] },
        });
      }
      const stored = {
        ...data,
        checkoutActorUserId: data.checkoutActorUserId ?? null,
        userId: data.userId ?? null,
        createdAt: new Date("2026-09-08T12:49:58.000Z"),
        discount: 0,
      };
      orders.push(stored);
      return stored;
    },
    findUnique: async ({ where }: { where: Record<string, string> }) =>
      orders.find(
        (item) =>
          item.id === where.id ||
          item.checkoutAttemptId === where.checkoutAttemptId,
      ) ?? null,
  };
  const prisma = {
    user: {
      findUnique: async ({
        where,
      }: {
        where: { email?: string; id?: string };
      }) =>
        where.email
          ? options.guestUserId
            ? { id: options.guestUserId }
            : null
          : where.id === "user-2" ||
              options.existingUserIds?.includes(where.id!)
            ? { id: where.id }
            : null,
    },
    order,
    $transaction: (operation: (tx: unknown) => Promise<unknown>) => {
      const transaction = transactionTail.then(async () => {
        const previousOrders = orders.map((value) => ({ ...value }));
        const previousEvents = createdEvents.map((value) => ({ ...value }));
        const previousActivations = activations;
        activeTransaction = {
          $queryRaw: async (query: { values?: unknown[] }) => {
            const ids = (query.values ?? []).map(String).sort();
            options.lockCalls?.push(`lock:${ids.join(",")}`);
            return ids.map((id) => ({ id }));
          },
          order,
        };
        try {
          const result = await operation(activeTransaction);
          if (options.commitFailure) throw options.commitFailure;
          return result;
        } catch (error) {
          orders.splice(0, orders.length, ...previousOrders);
          createdEvents.splice(0, createdEvents.length, ...previousEvents);
          activations = previousActivations;
          throw error;
        } finally {
          activeTransaction = undefined;
        }
      });
      transactionTail = transaction.then(
        () => undefined,
        () => undefined,
      );
      return transaction;
    },
  };
  const storage = new OrdersStorage(
    prisma as unknown as PrismaService,
    Object.assign(
      { getAffiliateOwnerUserId: async () => undefined },
      promocodesService,
    ),
    {
      attachGuestOrderInTransaction: async (
        _tx: unknown,
        guestOrder: { id: string },
      ) => {
        activations += 1;
        const stored = orders.find((item) => item.id === guestOrder.id);
        const guestUserId = options.guestUserId ?? "guest-user";
        if (stored) stored.userId = guestUserId;
        return guestUserId;
      },
    } as never,
    {
      enqueueOrderCreated: async (
        tx: unknown,
        snapshot: Record<string, unknown>,
      ) => {
        assert.ok(activeTransaction);
        assert.equal(tx, activeTransaction);
        enqueueAttempts += 1;
        if (options.enqueueFailure) throw options.enqueueFailure;
        createdEvents.push(snapshot);
      },
    } as never,
    createAccountingMock(),
  );
  (storage as unknown as { mapOrder: (value: unknown) => unknown }).mapOrder = (
    value,
  ) => value;

  return {
    activationCount: () => activations,
    createdEvents,
    enqueueAttempts: () => enqueueAttempts,
    orders,
    storage,
  };
}

function createThrottlePrisma() {
  type Row = {
    id: string;
    scope: string;
    subjectHash: string;
    requestCount: number;
    windowStartedAt: Date;
    lastRequestAt: Date;
    blockedUntil: Date | null;
  };
  const rows = new Map<string, Row>();
  const model = {
    upsert: async ({ create }: { create: Row }) => {
      const key = `${create.scope}:${create.subjectHash}`;
      if (!rows.has(key)) {
        rows.set(key, {
          ...create,
          id: key,
          blockedUntil: null,
        });
      }
      return rows.get(key);
    },
    findUnique: async ({
      where,
    }: {
      where: { scope_subjectHash: { scope: string; subjectHash: string } };
    }) =>
      rows.get(
        `${where.scope_subjectHash.scope}:${where.scope_subjectHash.subjectHash}`,
      ) ?? null,
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Row>;
    }) => {
      const entry = [...rows.entries()].find(([, row]) => row.id === where.id);
      if (!entry) throw new Error("Throttle row not found");
      Object.assign(entry[1], data);
      return entry[1];
    },
  };
  return {
    rows,
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
      operation({ orderCheckoutThrottle: model, $queryRaw: async () => [] }),
  };
}

function createRecoveryStorage(overrides: Record<string, unknown> = {}) {
  const state = {
    id: "order-1",
    cartId: "cart-1",
    userId: null,
    checkoutActorUserId: null,
    paymentMethod: "TBANK_ACQUIRING",
    paymentStatus: OrderPaymentStatus.PENDING,
    paymentRedirectUrl: "https://securepay.tinkoff.ru/session",
    terminalPaymentFailedAt: null,
    cartRestoredAt: null,
    items: [],
    shipments: [],
    ...overrides,
  };
  const tx = {
    $queryRaw: async () => [],
    order: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === state.id ? state : null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state, data);
        return state;
      },
    },
    orderHistory: { create: async () => undefined },
  };
  const storage = new OrdersStorage(
    {
      $transaction: async (operation: (client: unknown) => Promise<unknown>) =>
        operation(tx),
    } as unknown as PrismaService,
    {} as never,
    ...createUnusedStorageDependencies(),
  );

  return Object.assign(storage, { state });
}

function createUnusedStorageDependencies(): [
  OrderActivationService,
  AnalyticsOutboxService,
  AffiliateFinancialAccountingService,
] {
  return [
    {} as OrderActivationService,
    {} as AnalyticsOutboxService,
    createAccountingMock(),
  ];
}

function createAccountingMock() {
  return {
    recordPaidOrderInTransaction: async () => undefined,
    recordCompletionInTransaction: async () => undefined,
    recordRefundReversalInTransaction: async () => 0,
  } as unknown as AffiliateFinancialAccountingService;
}

function createOrderDTO(
  options: {
    method?: "tbank_acquiring";
    redirectUrl?: string;
  } = {},
) {
  return {
    id: "order-1",
    cartId: "cart-1",
    status: "waiting_payment" as const,
    customer: {
      email: "guest@example.com",
      name: "Анна Иванова",
      phone: "+7 (999) 123-45-67",
    },
    delivery: {
      provider: "cdek" as const,
      pickupPoint: {
        id: "point-1",
        title: "Point",
        address: "Address",
        workHours: "09:00-21:00",
        deliveryPrice: 100,
      },
    },
    payment: {
      method: options.method ?? ("tbank_acquiring" as const),
      status: "pending" as const,
      redirectUrl: options.redirectUrl ?? "https://pay.test",
    },
    items: [],
    shipments: [],
    itemsCount: 1,
    subtotal: 1000,
    discount: 0,
    deliveryPrice: 100,
    promoCode: null,
    total: 1100,
    currency: "RUB" as const,
    createdAt: "2026-09-05T12:00:00.000Z",
  };
}
