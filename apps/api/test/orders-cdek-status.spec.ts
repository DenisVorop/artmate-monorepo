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
import type { OrderActivationService } from "../src/auth/order-activation.service";
import type { AnalyticsOutboxService } from "../src/analytics/analytics-outbox.service";
import type { AffiliateFinancialAccountingService } from "../src/affiliate/financial-accounting.service";

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
      deliveryProvider: "CDEK",
      id: "order-1",
      paidAt: null as Date | null,
      completedAt: null as Date | null,
      paymentStatus: PrismaOrderPaymentStatus.PENDING,
      status: PrismaOrderStatus.PENDING_PAYMENT,
      userId: "user-1",
    };
    const orderUpdates: Record<string, unknown>[] = [];
    let orderLocks = 0;
    let completionUpdates = 0;
    const tx = {
      $queryRaw: async () => {
        orderLocks += 1;
        return [{ id: state.id }];
      },
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
        findUnique: async () => ({ statusCode: "DELIVERING" }),
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
      {} as OrderActivationService,
      {} as AnalyticsOutboxService,
      {
        recordPaidOrderInTransaction: async () => undefined,
        recordCompletionInTransaction: async () => {
          completionUpdates += 1;
        },
        recordRefundReversalInTransaction: async () => 0,
      } as AffiliateFinancialAccountingService,
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

    assert.equal(orderUpdates.length, 1);
    assert.equal(orderUpdates[0]?.crmStatus, PrismaOrderCrmStatus.COMPLETED);
    assert.ok(orderUpdates[0]?.completedAt instanceof Date);
    assert.equal(state.status, PrismaOrderStatus.PENDING_PAYMENT);
    assert.equal(state.paymentStatus, PrismaOrderPaymentStatus.PENDING);
    assert.equal(state.paidAt, null);
    assert.ok(state.completedAt);
    assert.equal(orderLocks, 1);
    assert.equal(completionUpdates, 1);
  });
});
