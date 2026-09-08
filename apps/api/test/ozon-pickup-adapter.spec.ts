import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadGatewayException, GatewayTimeoutException } from "@nestjs/common";

import { OzonLogisticsService } from "../src/ozon/ozon-logistics.service";
import type { OzonOAuthService } from "../src/ozon/ozon-oauth.service";

type PickupLogisticsService = {
  getDeliveryPointInfoBatch(mapPointIds: readonly string[]): Promise<unknown>;
  getDeliveryPointList(): Promise<unknown>;
};

describe("Ozon pickup dataset adapter", () => {
  it("strictly parses point/list and permits an explicit empty list", async () => {
    await withOzonLogisticsMode("real", async () => {
      const opaqueId = createOpaqueId(160);
      const service = createPickupServiceReturning([
        {
          points: [
            {
              coordinate: { lat: -90, long: -180 },
              map_point_id: opaqueId,
            },
            {
              coordinate: { lat: 90, long: 180 },
              map_point_id: 42,
            },
          ],
        },
        { points: [] },
      ]);

      assert.deepEqual(await service.getDeliveryPointList(), [
        { mapPointId: opaqueId, latitude: -90, longitude: -180 },
        { mapPointId: "42", latitude: 90, longitude: 180 },
      ]);
      assert.deepEqual(await service.getDeliveryPointList(), []);
    });
  });

  it("rejects malformed point/list payloads and duplicate IDs", async () => {
    await withOzonLogisticsMode("real", async () => {
      const invalidResponses = [
        null,
        [],
        {},
        { points: null },
        { points: [null] },
        { points: [{ map_point_id: "point-1", coordinate: null }] },
        {
          points: [
            {
              map_point_id: createOpaqueId(161),
              coordinate: { lat: 55.7, long: 37.6 },
            },
          ],
        },
        {
          points: [
            {
              map_point_id: "point-1",
              coordinate: { lat: Number.NaN, long: 37.6 },
            },
          ],
        },
        {
          points: [
            {
              map_point_id: "point-1",
              coordinate: { lat: 91, long: 37.6 },
            },
          ],
        },
        {
          points: [
            {
              map_point_id: "point-1",
              coordinate: { lat: 55.7, long: -181 },
            },
          ],
        },
        {
          points: [
            {
              map_point_id: "point-1",
              coordinate: { lat: 55.7, long: 37.6 },
            },
            {
              map_point_id: "point-1",
              coordinate: { lat: 55.8, long: 37.7 },
            },
          ],
        },
      ];

      for (const response of invalidResponses) {
        await assert.rejects(
          createPickupServiceReturning([response]).getDeliveryPointList(),
          /Ozon Logistics point-list response is invalid/,
        );
      }
    });
  });

  it("parses official point/info fields and returns explicit exclusions without coordinates", async () => {
    await withOzonLogisticsMode("real", async () => {
      let request: { body: unknown; path: string } | undefined;
      const points = [
        createPointInfo("disabled", { enabled: false }),
        createPointInfo("postamat", { deliveryTypeId: 1003 }),
        createPointInfo("pvz", {
          city: "Москва",
          region: "Москва",
          title: "Ozon ПВЗ",
        }),
      ];
      const service = createPickupService(async (path, body) => {
        request = { body, path };
        return { points: [points[2], points[0], points[1]] };
      });

      assert.deepEqual(
        await service.getDeliveryPointInfoBatch([
          "disabled",
          "postamat",
          "pvz",
        ]),
        [
          {
            eligible: false,
            mapPointId: "disabled",
            reason: "disabled",
          },
          {
            eligible: false,
            mapPointId: "postamat",
            reason: "unsupported_delivery_type",
          },
          {
            address: "Москва, Тверская, 1",
            eligible: true,
            mapPointId: "pvz",
            title: "Ozon ПВЗ",
            workHours: "09:00-21:30",
          },
        ],
      );
      assert.deepEqual(request, {
        body: { map_point_ids: ["disabled", "postamat", "pvz"] },
        path: "/v1/delivery/point/info",
      });
    });
  });

  it("does not require city grouping fields and skips closed working-hours days", async () => {
    await withOzonLogisticsMode("real", async () => {
      const point = createPointInfo("point-1", { city: "", region: "" });
      point.delivery_method.working_hours.unshift({ periods: [] });

      assert.deepEqual(
        await createPickupServiceReturning([
          { points: [point] },
        ]).getDeliveryPointInfoBatch(["point-1"]),
        [
          {
            address: "Москва, Тверская, 1",
            eligible: true,
            mapPointId: "point-1",
            title: "Ozon ПВЗ",
            workHours: "09:00-21:30",
          },
        ],
      );
    });
  });

  it("enforces point/info request size and unique valid IDs before calling upstream", async () => {
    await withOzonLogisticsMode("real", async () => {
      let callCount = 0;
      const service = createPickupService(async () => {
        callCount += 1;
        return { points: [] };
      });
      const invalidRequests = [
        [],
        Array.from({ length: 101 }, (_, index) => `point-${index}`),
        ["point-1", "point-1"],
        [""],
        [createOpaqueId(161)],
      ];

      for (const mapPointIds of invalidRequests) {
        await assert.rejects(
          service.getDeliveryPointInfoBatch(mapPointIds),
          /Ozon Logistics point-info request is invalid/,
        );
      }

      assert.equal(callCount, 0);
    });
  });

  it("requires an exact point/info response bijection regardless of order", async () => {
    await withOzonLogisticsMode("real", async () => {
      const invalidResponses = [
        null,
        {},
        { points: null },
        { points: [createPointInfo("point-1")] },
        {
          points: [createPointInfo("point-1"), createPointInfo("extra")],
        },
        {
          points: [createPointInfo("point-1"), createPointInfo("point-1")],
        },
      ];

      for (const response of invalidResponses) {
        await assert.rejects(
          createPickupServiceReturning([response]).getDeliveryPointInfoBatch([
            "point-1",
            "point-2",
          ]),
          /Ozon Logistics point-info response is invalid/,
        );
      }
    });
  });

  it("fails the whole point/info batch for malformed eligible fields", async () => {
    await withOzonLogisticsMode("real", async () => {
      const valid = createPointInfo("point-1");
      const invalidPoints = [
        { ...valid, enabled: "true" },
        { ...valid, delivery_method: { ...valid.delivery_method, name: "" } },
        {
          ...valid,
          delivery_method: { ...valid.delivery_method, address: null },
        },
        {
          ...valid,
          delivery_method: {
            ...valid.delivery_method,
            working_hours: [{ periods: [] }],
          },
        },
        {
          ...valid,
          delivery_method: {
            ...valid.delivery_method,
            working_hours: [{}],
          },
        },
        {
          ...valid,
          delivery_method: {
            ...valid.delivery_method,
            working_hours: [{ periods: null }],
          },
        },
        {
          ...valid,
          delivery_method: {
            ...valid.delivery_method,
            working_hours: [
              ...valid.delivery_method.working_hours,
              { periods: [{}] },
            ],
          },
        },
      ];

      for (const point of invalidPoints) {
        await assert.rejects(
          createPickupServiceReturning([
            { points: [point] },
          ]).getDeliveryPointInfoBatch(["point-1"]),
          /Ozon Logistics point-info response is invalid/,
        );
      }
    });
  });

  it("does not add service-layer wrapping to normalized OAuth errors", async () => {
    await withOzonLogisticsMode("real", async () => {
      const timeout = new GatewayTimeoutException("upstream timeout");
      const listService = createPickupService(async () => {
        throw timeout;
      });
      const pointInfoError = new BadGatewayException("upstream failure");
      const infoService = createPickupService(async () => {
        throw pointInfoError;
      });

      await assert.rejects(
        listService.getDeliveryPointList(),
        (error) => error === timeout,
      );
      await assert.rejects(
        infoService.getDeliveryPointInfoBatch(["point-1"]),
        (error) => error === pointInfoError,
      );
    });
  });
});

function createPickupService(
  requestSellerApi: (path: string, body: unknown) => Promise<unknown>,
) {
  return new OzonLogisticsService({
    requestSellerApi,
  } as unknown as OzonOAuthService) as unknown as PickupLogisticsService;
}

function createPickupServiceReturning(responses: unknown[]) {
  let responseIndex = 0;

  return createPickupService(async () => responses[responseIndex++]);
}

function createPointInfo(
  mapPointId: string,
  overrides: {
    city?: string;
    deliveryTypeId?: number;
    enabled?: boolean;
    region?: string;
    title?: string;
  } = {},
) {
  return {
    enabled: overrides.enabled ?? true,
    delivery_method: {
      address: "Москва, Тверская, 1",
      address_details: {
        city: overrides.city ?? "Москва",
        region: overrides.region ?? "Московская область",
      },
      coordinates: { lat: "must", long: "not be read" },
      delivery_type: { id: overrides.deliveryTypeId ?? 1002 },
      map_point_id: mapPointId,
      name: overrides.title ?? "Ozon ПВЗ",
      working_hours: [
        {
          periods: [
            {
              max: { hours: 21, minutes: 30 },
              min: { hours: 9, minutes: 0 },
            },
          ],
        },
      ],
    },
  };
}

function createOpaqueId(length: number) {
  const prefix = "Ozon/opaque:001-";

  return `${prefix}${"x".repeat(length - prefix.length)}`;
}

async function withOzonLogisticsMode(
  mode: "mock" | "real",
  callback: () => Promise<void>,
) {
  const previousMode = process.env.OZON_LOGISTICS_MODE;
  process.env.OZON_LOGISTICS_MODE = mode;

  try {
    await callback();
  } finally {
    if (previousMode === undefined) {
      delete process.env.OZON_LOGISTICS_MODE;
    } else {
      process.env.OZON_LOGISTICS_MODE = previousMode;
    }
  }
}
