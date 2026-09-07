import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { AnalyticsOutboxService } from "../src/analytics/analytics-outbox.service";
import { CreateOrderRequestDTO, OrderDTO } from "../src/orders/dto";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { YandexOfflineConversionsService } from "../src/analytics/yandex-offline-conversions.service";

describe("analytics order attribution and outbox", () => {
  it("accepts only bounded ASCII numeric private Yandex attribution", async () => {
    for (const value of ["1", "9".repeat(128)]) {
      const request = createRequest({ clientId: value, yclid: value });
      assert.deepEqual(await validate(request), []);
    }

    for (const value of [
      "123.456",
      "yclid-1",
      " 123 ",
      "abc",
      "абв",
      "１２３",
      "١٢٣",
      "1".repeat(129),
    ]) {
      const request = createRequest({ clientId: value, yclid: value });
      assert.notDeepEqual(await validate(request), [], value);
    }

    assert.equal("attribution" in new OrderDTO(), false);
    assert.equal("yandexClientId" in new OrderDTO(), false);
    assert.equal("yandexYclid" in new OrderDTO(), false);
  });

  it("persists a frozen no-PII paid snapshot through the supplied transaction writer", async () => {
    const writes: unknown[] = [];
    const tx = {
      analyticsOutboxEvent: {
        create: async (input: unknown) => {
          writes.push(input);
          return input;
        },
      },
    };
    const service = createService();
    const order = {
      id: "AM-PAID-1",
      customerEmail: "buyer@example.com",
      customerName: "Buyer",
      customerPhone: "+79990000000",
      deliveryPrice: 490,
      discount: 100,
      paidAt: new Date("2026-09-05T12:34:56.000Z"),
      subtotal: 2_997,
      yandexClientId: "123456",
      yandexYclid: "987654",
    };

    await service.enqueueOrderPaid(tx as never, order as never);

    assert.equal(writes.length, 1);
    const data = (writes[0] as { data: { payload: object } }).data;
    assert.deepEqual(data, {
      aggregateId: "AM-PAID-1",
      eventType: "order_paid",
      payload: {
        clientId: "123456",
        currency: "RUB",
        dateTime: 1788611696,
        price: "2897.00",
        purchaseId: "AM-PAID-1",
        target: "order_paid",
        yclid: "987654",
      },
    });
    assert.equal(Object.isFrozen(data.payload), true);
    assert.equal(JSON.stringify(data).includes("buyer@example.com"), false);
    assert.equal(JSON.stringify(data).includes("+79990000000"), false);
    assert.equal(JSON.stringify(data).includes("Buyer"), false);
  });

  it("drops invalid attribution before creating a paid outbox event", async () => {
    const writes: Array<{ data: { payload: object } }> = [];
    await createService().enqueueOrderPaid(
      {
        analyticsOutboxEvent: {
          create: async (input: { data: { payload: object } }) => writes.push(input),
        },
      } as never,
      {
        id: "AM-INVALID-ATTRIBUTION",
        discount: 0,
        paidAt: new Date("2026-09-05T12:34:56.000Z"),
        subtotal: 100,
        yandexClientId: "123.456",
        yandexYclid: "yclid-1",
      } as never,
    );

    assert.deepEqual(writes[0]?.data.payload, {
      currency: "RUB",
      dateTime: 1788611696,
      price: "100.00",
      purchaseId: "AM-INVALID-ATTRIBUTION",
      target: "order_paid",
    });
  });

  it("enqueues with PurchaseId when browser attribution is absent", async () => {
    const writes: Array<{ data: { payload: object } }> = [];
    const service = createService();
    const paidAt = new Date();
    await service.enqueueOrderPaid(
      {
        analyticsOutboxEvent: {
          create: async (input: { data: { payload: object } }) => {
            writes.push(input);
          },
        },
      } as never,
      {
        id: "AM-NO-ATTRIBUTION",
        discount: 0,
        paidAt,
        subtotal: 100,
        yandexClientId: null,
        yandexYclid: null,
      } as never,
    );

    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0]?.data.payload, {
      currency: "RUB",
      dateTime: Math.floor(paidAt.getTime() / 1_000),
      price: "100.00",
      purchaseId: "AM-NO-ATTRIBUTION",
      target: "order_paid",
    });
  });
});

function createRequest(attribution: { clientId: string; yclid: string }) {
  return plainToInstance(CreateOrderRequestDTO, {
    acceptedLegal: true,
    acceptedPersonalDataConsent: true,
    attribution,
    checkoutAttemptId: "attempt-1",
    customer: {
      email: "buyer@example.com",
      name: "Анна Иванова",
      phone: "+7 (999) 123-45-67",
    },
  });
}

function createService() {
  return new AnalyticsOutboxService(
    {} as PrismaService,
    {} as YandexOfflineConversionsService,
  );
}
