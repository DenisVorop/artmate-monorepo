import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OrderCrmStatus as PrismaOrderCrmStatus,
  OrderPaymentStatus as PrismaOrderPaymentStatus,
  OrderStatus as PrismaOrderStatus,
} from "../src/generated/prisma/client";
import { OrdersStorage } from "../src/orders/orders.storage";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { PromocodesService } from "../src/promocodes/promocodes.service";

type CdekStatusMapper = {
  getOrderStatusForCdekShipmentStatus(
    currentStatus: PrismaOrderCrmStatus,
    shipmentStatusCode: string,
  ): PrismaOrderCrmStatus | undefined;
};

const storage = Object.create(OrdersStorage.prototype) as CdekStatusMapper;

describe("CDEK order status mapping", () => {
  it("maps an active shipment from PAID to DELIVERING", () => {
    assert.equal(
      storage.getOrderStatusForCdekShipmentStatus(
        PrismaOrderCrmStatus.PAID,
        "RECEIVED_AT_SHIPMENT_WAREHOUSE",
      ),
      PrismaOrderCrmStatus.DELIVERING,
    );
  });

  it("maps a delivered shipment from DELIVERING to COMPLETED", () => {
    assert.equal(
      storage.getOrderStatusForCdekShipmentStatus(
        PrismaOrderCrmStatus.DELIVERING,
        "DELIVERED",
      ),
      PrismaOrderCrmStatus.COMPLETED,
    );
  });

  it("keeps payment fields unchanged when a shipment is delivered", async () => {
    const state = {
      crmStatus: PrismaOrderCrmStatus.DELIVERING,
      id: "order-1",
      paidAt: null as Date | null,
      paymentStatus: PrismaOrderPaymentStatus.PENDING,
      status: PrismaOrderStatus.PENDING_PAYMENT,
      userId: "user-1",
    };
    const orderUpdates: Record<string, unknown>[] = [];
    const tx = {
      order: {
        findUnique: async () => state,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          orderUpdates.push(data);
          Object.assign(state, data);
          return state;
        },
      },
      orderHistory: {
        create: async () => ({}),
      },
      orderShipment: {
        upsert: async () => ({}),
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
      order: {
        findFirst: async () => state,
      },
      orderShipment: {
        findFirst: async () => ({
          orderId: state.id,
          statusCode: "DELIVERING",
        }),
      },
    } as unknown as PrismaService;
    const storage = new OrdersStorage(
      prisma,
      {} as PromocodesService,
    );
    (storage as unknown as { mapOrder: (value: unknown) => unknown }).mapOrder =
      (value) => value;

    await storage.applyCdekOrderStatusWebhook({
      cdekNumber: "1234567890",
      externalUuid: "cdek-order-1",
      raw: {},
      statusCode: "DELIVERED",
      statusName: "Delivered",
    });

    assert.deepEqual(orderUpdates, [
      {
        crmStatus: PrismaOrderCrmStatus.COMPLETED,
      },
    ]);
    assert.equal(state.status, PrismaOrderStatus.PENDING_PAYMENT);
    assert.equal(state.paymentStatus, PrismaOrderPaymentStatus.PENDING);
    assert.equal(state.paidAt, null);
  });
});
