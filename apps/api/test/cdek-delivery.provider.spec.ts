import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CdekClientService } from "../src/delivery/providers/cdek/cdek-client.service";
import { CdekDeliveryProvider } from "../src/delivery/providers/cdek/cdek-delivery.provider";
import type { CdekOrderInfoResponse } from "../src/delivery/providers/cdek/cdek.types";

describe("CdekDeliveryProvider order status selection", () => {
  it("selects the latest status from a newest-first response", async () => {
    const provider = createProviderReturning({
      entity: {
        statuses: [
          {
            code: "DELIVERED",
            date_time: "2026-08-24T12:00:00+0300",
            name: "Delivered",
          },
          {
            code: "ACCEPTED",
            date_time: "2026-08-20T09:00:00+0300",
            name: "Accepted",
          },
        ],
      },
    });

    const order = await provider.getOrder("order-uuid");

    assert.equal(order.statusCode, "DELIVERED");
    assert.equal(order.statusName, "Delivered");
  });

  it("selects the greatest dated status from an out-of-order response", async () => {
    const provider = createProviderReturning({
      entity: {
        statuses: [
          {
            code: "ACCEPTED",
            date_time: "2026-08-20T09:00:00+0300",
          },
          {
            code: "DELIVERED",
            date_time: "2026-08-24T12:00:00+0300",
          },
          {
            code: "CREATED",
            date_time: "2026-08-18T08:00:00+0300",
          },
        ],
      },
    });

    const order = await provider.getOrder("order-uuid");

    assert.equal(order.statusCode, "DELIVERED");
  });

  it("ignores deleted statuses", async () => {
    const provider = createProviderReturning({
      entity: {
        statuses: [
          {
            code: "DELIVERED",
            date_time: "2026-08-25T12:00:00+0300",
            deleted: true,
          },
          {
            code: "READY_FOR_DELIVERY",
            date_time: "2026-08-24T12:00:00+0300",
          },
        ],
      },
    });

    const order = await provider.getOrder("order-uuid");

    assert.equal(order.statusCode, "READY_FOR_DELIVERY");
  });

  it("prefers a parseable date over invalid or missing dates", async () => {
    const provider = createProviderReturning({
      entity: {
        statuses: [
          { code: "INVALID_DATE", date_time: "not-a-date" },
          { code: "MISSING_DATE" },
          {
            code: "DELIVERED",
            date_time: "2026-08-24T12:00:00+0300",
          },
        ],
      },
    });

    const order = await provider.getOrder("order-uuid");

    assert.equal(order.statusCode, "DELIVERED");
  });

  it("retains the first active status when no date is parseable", async () => {
    const provider = createProviderReturning({
      entity: {
        statuses: [
          { code: "FIRST_ACTIVE", date_time: "not-a-date" },
          { code: "MISSING_DATE" },
          { code: "ANOTHER_INVALID_DATE", date_time: "invalid" },
        ],
      },
    });

    const order = await provider.getOrder("order-uuid");

    assert.equal(order.statusCode, "FIRST_ACTIVE");
  });

  it("leaves status fields unset when no active status exists", async () => {
    const responses: CdekOrderInfoResponse[] = [
      { entity: { statuses: [] } },
      {
        entity: {
          statuses: [
            {
              code: "DELETED",
              date_time: "2026-08-24T12:00:00+0300",
              deleted: true,
              name: "Deleted",
            },
          ],
        },
      },
    ];

    for (const response of responses) {
      const order = await createProviderReturning(response).getOrder(
        "order-uuid",
      );

      assert.equal(order.statusCode, undefined);
      assert.equal(order.statusName, undefined);
    }
  });
});

function createProviderReturning(response: CdekOrderInfoResponse) {
  const cdekClient = {
    request: async () => response,
  } as unknown as CdekClientService;

  return new CdekDeliveryProvider(cdekClient);
}
