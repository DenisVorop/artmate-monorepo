import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  ServiceUnavailableException,
} from "@nestjs/common";

import { ozonSellerApiMaxConcurrentRequests } from "../src/ozon/ozon.constants";
import { OzonLogisticsService } from "../src/ozon/ozon-logistics.service";
import type { OzonOAuthService } from "../src/ozon/ozon-oauth.service";

describe("OzonLogisticsService pickup index and live validation", () => {
  it("strictly requests and parses point-list for sync", async () => {
    await withMode("real", async () => {
      const calls: unknown[] = [];
      const service = createService(async (path, body) => {
        calls.push([path, body]);
        return {
          points: [
            {
              coordinate: { lat: 55.75, long: 37.61 },
              map_point_id: "point-1",
            },
          ],
        };
      });

      assert.deepEqual(await service.getDeliveryPointList(), [
        { latitude: 55.75, longitude: 37.61, mapPointId: "point-1" },
      ]);
      assert.deepEqual(calls, [["/v1/delivery/point/list", {}]]);
    });
  });

  it("strictly parses eligible and excluded point-info in request order", async () => {
    await withMode("real", async () => {
      const service = createService(async () => ({
        points: [
          { enabled: false, delivery_method: { map_point_id: "disabled" } },
          createSyncPoint("eligible"),
          {
            enabled: true,
            delivery_method: {
              delivery_type: { id: 1003 },
              map_point_id: "postamat",
            },
          },
        ],
      }));

      const points = await service.getDeliveryPointInfoBatch([
        "eligible",
        "disabled",
        "postamat",
      ]);

      assert.equal(points[0]?.mapPointId, "eligible");
      assert.deepEqual(points.slice(1), [
        { eligible: false, mapPointId: "disabled", reason: "disabled" },
        {
          eligible: false,
          mapPointId: "postamat",
          reason: "unsupported_delivery_type",
        },
      ]);
    });
  });

  it("rejects invalid and non-bijective sync responses", async () => {
    await withMode("real", async () => {
      await assert.rejects(
        createService(async () => ({ points: [] })).getDeliveryPointInfoBatch([
          "point-1",
        ]),
        BadGatewayException,
      );
      await assert.rejects(
        createService(async () => ({ points: [] })).getDeliveryPointInfoBatch(
          [],
        ),
        BadRequestException,
      );
      await assert.rejects(
        createService(async () => ({
          points: [
            { coordinate: { lat: 55, long: 37 }, map_point_id: "duplicate" },
            { coordinate: { lat: 56, long: 38 }, map_point_id: "duplicate" },
          ],
        })).getDeliveryPointList(),
        BadGatewayException,
      );
    });
  });

  it("preserves transient upstream statuses for worker retry policy", async () => {
    await withMode("real", async () => {
      for (const status of [429, 502, 503, 504]) {
        const upstream = new HttpException("upstream", status);
        const service = createService(async () => {
          throw upstream;
        });

        await assert.rejects(
          service.getDeliveryPointList(),
          (error) => error === upstream,
        );
        await assert.rejects(
          service.getDeliveryPointInfoBatch(["point-1"]),
          (error) => error === upstream,
        );
      }
    });
  });

  it("never exposes sync methods in mock mode", async () => {
    await withMode("mock", async () => {
      let calls = 0;
      const service = createService(async () => {
        calls += 1;
        return {};
      });

      await assert.rejects(
        service.getDeliveryPointList(),
        ServiceUnavailableException,
      );
      await assert.rejects(
        service.getDeliveryPointInfoBatch(["point-1"]),
        ServiceUnavailableException,
      );
      assert.equal(calls, 0);
    });
  });

  it("keeps live selected-point validation for quote and order", async () => {
    await withMode("real", async () => {
      const calls: unknown[] = [];
      const service = createService(async (path, body) => {
        calls.push([path, body]);
        return { points: [createLivePoint("opaque-point-id")] };
      });

      const point = await service.getPickupPoint("opaque-point-id");

      assert.equal(point.id, "opaque-point-id");
      assert.equal(point.address, "Москва, Тверская, 1");
      assert.deepEqual(calls, [
        ["/v1/delivery/point/info", { map_point_ids: ["opaque-point-id"] }],
      ]);
    });
  });

  it("accepts an explicit empty schedule for a live selected point", async () => {
    await withMode("real", async () => {
      const point = createLivePoint("2655484", { workingHours: [] });
      const service = createService(async () => ({ points: [point] }));

      assert.equal(
        (await service.getPickupPoint("2655484")).workHours,
        "График работы уточняется",
      );
    });
  });

  it("strictly parses structured live schedules", async () => {
    await withMode("real", async () => {
      const point = createLivePoint("point-1", {
        workingHours: [
          { periods: [] },
          {
            periods: [
              {
                min: { hours: 9, minutes: 5 },
                max: { hours: 21, minutes: 30 },
              },
            ],
          },
        ],
      });
      const service = createService(async () => ({ points: [point] }));

      assert.equal(
        (await service.getPickupPoint("point-1")).workHours,
        "09:05-21:30",
      );
    });
  });

  it("rejects malformed live selected-point schedules", async () => {
    await withMode("real", async () => {
      const validPeriod = {
        min: { hours: 9, minutes: 0 },
        max: { hours: 21, minutes: 0 },
      };
      const invalidSchedules = [
        undefined,
        null,
        {},
        [null],
        [{ periods: [] }],
        [
          {
            periods: [{ min: { hours: 24, minutes: 0 }, max: validPeriod.max }],
          },
        ],
        [{ periods: [] }, { periods: [validPeriod, {}] }],
      ];
      const missingSchedule = createLivePoint("point-1");
      const deliveryMethod: Record<string, unknown> = {
        ...missingSchedule.delivery_method,
      };
      delete deliveryMethod.working_hours;

      await assert.rejects(
        createService(async () => ({
          points: [
            {
              ...missingSchedule,
              delivery_method: {
                ...deliveryMethod,
                work_hours: "09:00-21:00",
              },
            },
          ],
        })).getPickupPoint("point-1"),
        BadGatewayException,
      );

      for (const workingHours of invalidSchedules) {
        const point = createLivePoint("point-1", { workingHours });

        await assert.rejects(
          createService(async () => ({ points: [point] })).getPickupPoint(
            "point-1",
          ),
          BadGatewayException,
        );
      }
    });
  });

  it("fails closed for unavailable or malformed live selected points", async () => {
    await withMode("real", async () => {
      await assert.rejects(
        createService(async () => ({
          points: [{ ...createLivePoint("point-1"), enabled: false }],
        })).getPickupPoint("point-1"),
        BadRequestException,
      );
      await assert.rejects(
        createService(async () => ({
          points: [
            {
              ...createLivePoint("point-1"),
              delivery_method: {
                ...createLivePoint("point-1").delivery_method,
                address: "",
              },
            },
          ],
        })).getPickupPoint("point-1"),
        BadGatewayException,
      );
    });
  });

  it("bounds strict sync transport concurrency and releases slots", async () => {
    await withMode("real", async () => {
      let calls = 0;
      let release!: () => void;
      let timeout = true;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const service = createService(async () => {
        calls += 1;
        await gate;
        if (timeout) throw new GatewayTimeoutException("timeout");
        return { points: [] };
      });
      const requests = Array.from(
        { length: ozonSellerApiMaxConcurrentRequests + 1 },
        () => service.getDeliveryPointList(),
      );
      const settled = Promise.allSettled(requests);

      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(calls, ozonSellerApiMaxConcurrentRequests);
      release();
      const results = await settled;
      const overflowResult = results[results.length - 1];

      assert.equal(overflowResult?.status, "rejected");
      if (overflowResult?.status === "rejected") {
        assert.ok(overflowResult.reason instanceof ServiceUnavailableException);
      }

      timeout = false;
      assert.deepEqual(await service.getDeliveryPointList(), []);
    });
  });
});

function createService(
  requestSellerApi: (path: string, body: unknown) => Promise<unknown>,
) {
  return new OzonLogisticsService({
    requestSellerApi,
  } as unknown as OzonOAuthService);
}

function createSyncPoint(mapPointId: string) {
  return {
    enabled: true,
    delivery_method: {
      address: "Москва, Тверская, 1",
      address_details: { city: "Москва", region: "Москва" },
      delivery_type: { id: 1002 },
      map_point_id: mapPointId,
      name: "Ozon ПВЗ",
      working_hours: [
        {
          periods: [
            {
              min: { hours: 9, minutes: 0 },
              max: { hours: 21, minutes: 30 },
            },
          ],
        },
      ],
    },
  };
}

function createLivePoint(
  mapPointId: string,
  options: { workingHours?: unknown } = {},
) {
  return {
    enabled: true,
    delivery_method: {
      address: "Москва, Тверская, 1",
      delivery_type: { id: 1002 },
      map_point_id: mapPointId,
      name: "Ozon ПВЗ",
      working_hours: Object.hasOwn(options, "workingHours")
        ? options.workingHours
        : [
            {
              periods: [
                {
                  min: { hours: 9, minutes: 0 },
                  max: { hours: 21, minutes: 0 },
                },
              ],
            },
          ],
    },
  };
}

async function withMode(mode: "mock" | "real", run: () => Promise<void>) {
  const previous = process.env.OZON_LOGISTICS_MODE;
  process.env.OZON_LOGISTICS_MODE = mode;

  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.OZON_LOGISTICS_MODE;
    else process.env.OZON_LOGISTICS_MODE = previous;
  }
}
