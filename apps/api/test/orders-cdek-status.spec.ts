import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OrderCrmStatus as PrismaOrderCrmStatus } from "../src/generated/prisma/client";
import { OrdersStorage } from "../src/orders/orders.storage";

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
});
