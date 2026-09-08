import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadGatewayException, NotFoundException } from "@nestjs/common";

import type { CdekClientService } from "../src/delivery/providers/cdek/cdek-client.service";
import { CdekDeliveryProvider } from "../src/delivery/providers/cdek/cdek-delivery.provider";
import type { CdekOrderInfoResponse } from "../src/delivery/providers/cdek/cdek.types";

describe("CdekDeliveryProvider city details", () => {
  it("requests and maps the exact Russian city", async () => {
    const requests: unknown[] = [];
    const provider = new CdekDeliveryProvider({
      request: async (path: string, options: unknown) => {
        requests.push([path, options]);
        return [
          {
            city: "Москва",
            code: 44,
            country_code: "RU",
            latitude: 55.7558,
            longitude: 37.6176,
            region: "Москва",
          },
        ];
      },
    } as unknown as CdekClientService);

    assert.deepEqual(await provider.getCity(44), {
      code: 44,
      countryCode: "RU",
      latitude: 55.7558,
      longitude: 37.6176,
      name: "Москва",
      region: "Москва",
    });
    assert.deepEqual(requests, [
      [
        "/v2/location/cities",
        { query: { code: 44, country_codes: "RU", page: 0, size: 1 } },
      ],
    ]);
  });

  it("accepts zero and boundary coordinates", async () => {
    for (const [latitude, longitude] of [
      [0, 0],
      [-90, -180],
      [90, 180],
    ]) {
      const city = await createProviderReturning([
        {
          city: "Город",
          code: 1,
          country_code: "RU",
          latitude,
          longitude,
          region: "Регион",
        },
      ]).getCity(1);

      assert.equal(city.latitude, latitude);
      assert.equal(city.longitude, longitude);
    }
  });

  it("rejects mismatched, non-Russian and unknown city responses", async () => {
    for (const response of [
      [],
      [
        {
          city: "Другой",
          code: 45,
          country_code: "RU",
          latitude: 1,
          longitude: 1,
          region: "R",
        },
      ],
      [
        {
          city: "Минск",
          code: 44,
          country_code: "BY",
          latitude: 1,
          longitude: 1,
          region: "R",
        },
      ],
    ]) {
      await assert.rejects(
        createProviderReturning(response).getCity(44),
        NotFoundException,
      );
    }
  });

  it("rejects missing or invalid coordinates and required names", async () => {
    const base = {
      city: "Москва",
      code: 44,
      country_code: "RU",
      latitude: 55,
      longitude: 37,
      region: "Москва",
    };
    const invalid = [
      { ...base, latitude: undefined },
      { ...base, longitude: Number.NaN },
      { ...base, latitude: 91 },
      { ...base, longitude: -181 },
      { ...base, city: "" },
      { ...base, region: undefined },
    ];

    for (const city of invalid) {
      await assert.rejects(
        createProviderReturning([city]).getCity(44),
        BadGatewayException,
      );
    }
  });
});

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
      const order =
        await createProviderReturning(response).getOrder("order-uuid");

      assert.equal(order.statusCode, undefined);
      assert.equal(order.statusName, undefined);
    }
  });
});

describe("CdekDeliveryProvider order creation", () => {
  it("sends the required formatted checkout phone as normalized E.164 digits", async () => {
    const previousShipmentPoint = process.env.CDEK_SHIPMENT_POINT_CODE;
    let requestBody: unknown;
    process.env.CDEK_SHIPMENT_POINT_CODE = "MSK-1";
    const provider = new CdekDeliveryProvider({
      request: async (_path: string, options: { body?: unknown }) => {
        requestBody = options.body;
        return { requests: [{ state: "ACCEPTED" }] };
      },
    } as unknown as CdekClientService);

    try {
      await provider.createOrder({
        id: "order-1",
        customer: {
          email: "buyer@example.com",
          name: "Анна Иванова",
          phone: "+7 (999) 123-45-67",
        },
        delivery: {
          provider: "cdek",
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
            lineTotal: 100,
            price: 100,
            quantity: 1,
            slug: "product-1",
            title: "Product",
          },
        ],
      });

      assert.equal(
        (requestBody as { recipient: { phones: Array<{ number: string }> } })
          .recipient.phones[0]?.number,
        "+79991234567",
      );
    } finally {
      if (previousShipmentPoint === undefined)
        delete process.env.CDEK_SHIPMENT_POINT_CODE;
      else process.env.CDEK_SHIPMENT_POINT_CODE = previousShipmentPoint;
    }
  });
});

function createProviderReturning(response: unknown) {
  const cdekClient = {
    request: async () => response,
  } as unknown as CdekClientService;

  return new CdekDeliveryProvider(cdekClient);
}
