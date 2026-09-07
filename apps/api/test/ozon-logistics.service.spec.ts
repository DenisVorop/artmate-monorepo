import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import {
  StorefrontOzonDeliveryMapRequestDTO,
  StorefrontOzonDeliveryMapClusterDTO,
  StorefrontOzonDeliveryPointInfoRequestDTO,
} from "../src/delivery/dto";
import { DeliveryPickupPointDTO } from "../src/delivery/dto/delivery-pickup-point.dto";
import { CreateOrderDeliveryRequestDTO } from "../src/orders/dto/create-order-delivery-request.dto";
import { PickupPointDTO } from "../src/orders/dto/pickup-point.dto";
import {
  OzonDeliveryMapClusterDTO,
  OzonDeliveryMapPointDTO,
  OzonDeliveryMapRequestDTO,
  OzonDeliveryPointInfoDTO,
  OzonDeliveryPointInfoRequestDTO,
} from "../src/ozon/dto";
import { ozonSellerApiMaxConcurrentRequests } from "../src/ozon/ozon.constants";
import { OzonLogisticsService } from "../src/ozon/ozon-logistics.service";
import { OZON_MOCK_PICKUP_POINTS } from "../src/ozon/ozon-logistics.mock-data";
import type { OzonOAuthService } from "../src/ozon/ozon-oauth.service";

describe("Ozon logistics storefront mapping", () => {
  it("requests and normalizes the complete Ozon delivery point list", async () => {
    await withOzonLogisticsMode("real", async () => {
      const calls: Array<{ body: unknown; path: string }> = [];
      const opaqueId = "90071992547409931234";
      const service = new OzonLogisticsService({
        requestSellerApi: async (path: string, body: unknown) => {
          calls.push({ body, path });

          return {
            points: [
              {
                coordinate: { lat: -90, long: -180 },
                map_point_id: 42,
              },
              {
                coordinate: { lat: 90, long: 180 },
                map_point_id: opaqueId,
              },
            ],
          };
        },
      } as unknown as OzonOAuthService);

      assert.deepEqual(await service.getDeliveryPointList(), [
        { mapPointId: "42", latitude: -90, longitude: -180 },
        { mapPointId: opaqueId, latitude: 90, longitude: 180 },
      ]);
      assert.deepEqual(calls, [
        { body: {}, path: "/v1/delivery/point/list" },
      ]);
    });
  });

  it("accepts an explicit empty Ozon delivery point list", async () => {
    await withOzonLogisticsMode("real", async () => {
      assert.deepEqual(
        await createLogisticsServiceReturning({
          points: [],
        }).getDeliveryPointList(),
        [],
      );
    });
  });

  it("rejects malformed Ozon delivery point list responses with Bad Gateway", async () => {
    await withOzonLogisticsMode("real", async () => {
      const invalidResponses = [
        {},
        { points: null },
        { points: {} },
        { points: [null] },
        { points: [{}] },
        {
          points: [{ coordinate: { lat: 55.76, long: 37.61 } }],
        },
        {
          points: [{ coordinate: { lat: Number.NaN, long: 37.61 }, map_point_id: 1 }],
        },
        {
          points: [
            {
              coordinate: { lat: "55.76", long: 37.61 },
              map_point_id: 1,
            },
          ],
        },
        {
          points: [{ coordinate: { lat: 91, long: 37.61 }, map_point_id: 1 }],
        },
        {
          points: [{ coordinate: { lat: 55.76, long: -181 }, map_point_id: 1 }],
        },
        {
          points: [
            {
              coordinate: { lat: 55.76, long: 37.61 },
              map_point_id: Number.MAX_SAFE_INTEGER + 1,
            },
          ],
        },
        null,
        [],
      ];

      for (const response of invalidResponses) {
        await assert.rejects(
          createLogisticsServiceReturning(response).getDeliveryPointList(),
          (error) =>
            error instanceof BadGatewayException && error.getStatus() === 502,
        );
      }
    });
  });

  it("keeps the mock delivery point list deterministic and aligned", async () => {
    await withOzonLogisticsMode("mock", async () => {
      const service = new OzonLogisticsService({} as OzonOAuthService);
      const expectedPoints = OZON_MOCK_PICKUP_POINTS.map((point) => ({
        mapPointId: String(point.mapPointId),
        latitude: point.lat,
        longitude: point.long,
      }));

      assert.deepEqual(await service.getDeliveryPointList(), expectedPoints);
      assert.deepEqual(await service.getDeliveryPointList(), expectedPoints);
    });
  });

  it("normalizes map clusters and keeps only available staffed PVZ details", async () => {
    await withOzonLogisticsMode("real", async () => {
      const calls: Array<{ body: unknown; path: string }> = [];
      const pointInfo = [
        {
          enabled: false,
          delivery_method: {
            address: "Москва, Тверская, 0",
            delivery_type: { id: 1002, name: "Самовывоз" },
            map_point_id: "10",
            name: "Закрытый ПВЗ",
            work_hours: "09:00-20:00",
          },
        },
        {
          enabled: true,
          delivery_method: {
            address: "Москва, Тверская, 1",
            coordinates: { lat: 55.76, long: 37.61 },
            delivery_type: { id: 1002, name: "Самовывоз" },
            map_point_id: "11",
            name: "Ozon ПВЗ",
            work_hours: "09:00-21:00",
          },
        },
        {
          enabled: true,
          delivery_method: {
            address: "Москва, Тверская, 2",
            coordinates: { lat: 55.77, long: 37.62 },
            delivery_type: { id: 1003, name: "Постамат" },
            map_point_id: "12",
            name: "Ozon Постамат",
            work_hours: "08:00-22:00",
          },
        },
      ];
      const oauth = {
        requestSellerApi: async (path: string, body: unknown) => {
          calls.push({ body, path });

          if (path === "/v1/delivery/map") {
            return {
              clusters: [
                {
                  coordinate: { lat: 55.76, long: 37.61 },
                  is_same_building: false,
                  map_point_ids: ["11"],
                  points_count: 1,
                  viewport: {
                    left_bottom: { lat: 55.75, long: 37.6 },
                    right_top: { lat: 55.77, long: 37.62 },
                  },
                },
              ],
            };
          }

          if (path === "/v1/delivery/point/info") {
            const requestedIds = (body as { map_point_ids?: readonly string[] })
              .map_point_ids;

            return {
              points: pointInfo.filter((point) =>
                requestedIds?.includes(point.delivery_method.map_point_id),
              ),
            };
          }

          throw new Error(`Unexpected Ozon Seller API path: ${path}`);
        },
      } as unknown as OzonOAuthService;
      const service = new OzonLogisticsService(oauth);
      const mapRequest = {
        viewport: {
          left_bottom: { lat: 55.55, long: 37.35 },
          right_top: { lat: 55.95, long: 37.85 },
        },
        zoom: 11,
      };

      const clusters = await service.getMapClusters(mapRequest);
      const points = (await service.getPickupPointsByIds([
        "10",
        "11",
        "12",
      ] as const)) as Array<{ id: string }>;

      assert.deepEqual(clusters[0], {
        coordinate: { lat: 55.76, long: 37.61 },
        isSameBuilding: false,
        mapPointIds: ["11"],
        pointsCount: 1,
        viewport: {
          leftBottom: { lat: 55.75, long: 37.6 },
          rightTop: { lat: 55.77, long: 37.62 },
        },
      });
      assert.deepEqual(
        points.map((point) => point.id),
        ["11"],
      );
      assert.deepEqual(await service.getPickupPoint("11"), {
        id: "11",
        title: "Ozon ПВЗ",
        address: "Москва, Тверская, 1",
        workHours: "09:00-21:00",
        deliveryPrice: 100,
        latitude: 55.76,
        longitude: 37.61,
      });
      assert.deepEqual(calls, [
        { body: mapRequest, path: "/v1/delivery/map" },
        {
          body: { map_point_ids: ["10", "11", "12"] },
          path: "/v1/delivery/point/info",
        },
        {
          body: { map_point_ids: ["11"] },
          path: "/v1/delivery/point/info",
        },
      ]);
    });
  });

  it("rejects a requested point missing from the Ozon response", async () => {
    await withOzonLogisticsMode("real", async () => {
      let requestBody: unknown;
      const oauth = {
        requestSellerApi: async (path: string, body: unknown) => {
          assert.equal(path, "/v1/delivery/point/info");
          requestBody = body;

          return { points: [] };
        },
      } as unknown as OzonOAuthService;
      const service = new OzonLogisticsService(oauth);

      await assert.rejects(
        service.getPickupPoint("90071992547409931234"),
        (error) => error instanceof BadGatewayException,
      );
      assert.deepEqual(requestBody, {
        map_point_ids: ["90071992547409931234"],
      });
    });
  });

  it("keeps mock point lookup aligned with the real storefront contract", async () => {
    await withOzonLogisticsMode("mock", async () => {
      const service = new OzonLogisticsService({} as OzonOAuthService);

      const points = await service.getPickupPointsByIds([
        "100101",
        "100105",
        "200204",
      ] as const);
      const clusters = (await service.getMapClusters({
        viewport: {
          left_bottom: { lat: 55.55, long: 37.35 },
          right_top: { lat: 55.95, long: 37.85 },
        },
        zoom: 11,
      })) as Array<{ mapPointIds: string[] }>;

      assert.deepEqual(points, [
        {
          address: "Москва, ул. Тверская, 12с1",
          deliveryPrice: 100,
          id: "100101",
          latitude: 55.762147,
          longitude: 37.608103,
          title: "Ozon ПВЗ, Тверская",
          workHours: "Ежедневно 09:00-22:00",
        },
      ]);
      assert.equal(
        clusters.every((cluster) =>
          cluster.mapPointIds.every((id) => typeof id === "string"),
        ),
        true,
      );
      const normalizedIds = clusters.flatMap((cluster) => cluster.mapPointIds);

      assert.equal(new Set(normalizedIds).size, normalizedIds.length);
    });
  });

  it("makes mock aggregate and terminal clusters actionable for the storefront", async () => {
    await withOzonLogisticsMode("mock", async () => {
      const service = new OzonLogisticsService({} as OzonOAuthService);
      const request = createMapRequest();

      const aggregateClusters = await service.getMapClusters(request);
      const terminalClusters = await service.getMapClusters({
        ...request,
        zoom: 13,
      });

      assert.equal(aggregateClusters.length > 0, true);
      assert.equal(
        aggregateClusters.every(
          (cluster) =>
            !cluster.isSameBuilding && cluster.viewport !== undefined,
        ),
        true,
      );
      assert.equal(terminalClusters.length > 0, true);
      assert.equal(
        terminalClusters.every(
          (cluster) => cluster.isSameBuilding && cluster.viewport === undefined,
        ),
        true,
      );
    });
  });

  it("normalizes legacy leaf map points into storefront clusters", async () => {
    await withOzonLogisticsMode("real", async () => {
      const oauth = {
        requestSellerApi: async () => ({
          points: [
            {
              coordinate: { lat: 55.76, long: 37.61 },
              map_point_id: "11",
            },
          ],
        }),
      } as unknown as OzonOAuthService;
      const service = new OzonLogisticsService(oauth);

      const clusters = await service.getMapClusters({
        viewport: {
          left_bottom: { lat: 55.55, long: 37.35 },
          right_top: { lat: 55.95, long: 37.85 },
        },
        zoom: 19,
      });

      assert.deepEqual(clusters, [
        {
          coordinate: { lat: 55.76, long: 37.61 },
          isSameBuilding: true,
          mapPointIds: ["11"],
          pointsCount: 1,
        },
      ]);
    });
  });

  it("preserves a wrapped cluster and its IDs while omitting its unusable viewport", async () => {
    await withOzonLogisticsMode("real", async () => {
      const service = createLogisticsServiceReturning({
        clusters: [
          {
            coordinate: { lat: 55.76, long: 179.9 },
            is_same_building: false,
            map_point_ids: ["east-opaque", "west-opaque"],
            points_count: 2,
            viewport: {
              left_bottom: { lat: 55.7, long: 170 },
              right_top: { lat: 55.8, long: -170 },
            },
          },
        ],
      });

      assert.deepEqual(await service.getMapClusters(createMapRequest()), [
        {
          coordinate: { lat: 55.76, long: 179.9 },
          isSameBuilding: false,
          mapPointIds: ["east-opaque", "west-opaque"],
          pointsCount: 2,
        },
      ]);
    });
  });

  it("preserves exact-boundary opaque IDs from cluster and leaf map payloads", async () => {
    await withOzonLogisticsMode("real", async () => {
      const clusterId = createOpaqueId(160, " cluster/opaque:001-");
      const leafId = createOpaqueId(160, " leaf/opaque:001-");
      const service = createLogisticsServiceReturning({
        clusters: [
          {
            coordinate: { lat: 55.76, long: 37.61 },
            is_same_building: true,
            map_point_ids: [clusterId],
            points_count: 1,
          },
        ],
        points: [
          {
            coordinate: { lat: 55.77, long: 37.62 },
            map_point_id: leafId,
          },
        ],
      });
      const clusters = await service.getMapClusters(createMapRequest());

      assert.deepEqual(
        clusters.map((cluster) => cluster.mapPointIds[0]),
        [clusterId, leafId],
      );
    });
  });

  it("rejects cluster and leaf map IDs above the persisted boundary", async () => {
    await withOzonLogisticsMode("real", async () => {
      const oversizedId = createOpaqueId(161);
      const responses = [
        {
          clusters: [
            {
              coordinate: { lat: 55.76, long: 37.61 },
              is_same_building: true,
              map_point_ids: [oversizedId],
              points_count: 1,
            },
          ],
        },
        {
          points: [
            {
              coordinate: { lat: 55.76, long: 37.61 },
              map_point_id: oversizedId,
            },
          ],
        },
      ];

      for (const response of responses) {
        await assert.rejects(
          createLogisticsServiceReturning(response).getMapClusters(
            createMapRequest(),
          ),
          (error) =>
            error instanceof BadGatewayException && error.getStatus() === 502,
        );
      }
    });
  });

  it("preserves exact persisted point-info boundaries and opaque IDs byte-for-byte", async () => {
    await withOzonLogisticsMode("real", async () => {
      const mapPointId = createOpaqueId(160);
      const title = "T".repeat(180);
      const workHours = "W".repeat(120);
      let requestBody: unknown;
      const service = new OzonLogisticsService({
        requestSellerApi: async (_path: string, body: unknown) => {
          requestBody = body;

          return {
            points: [createPointInfo({ mapPointId, title, workHours })],
          };
        },
      } as unknown as OzonOAuthService);

      assert.deepEqual(await service.getPickupPoint(mapPointId), {
        address: "Москва, Тверская, 1",
        deliveryPrice: 100,
        id: mapPointId,
        title,
        workHours,
      });
      assert.deepEqual(requestBody, { map_point_ids: [mapPointId] });
    });
  });

  it("rejects point-info snapshot fields above persisted boundaries with Bad Gateway", async () => {
    await withOzonLogisticsMode("real", async () => {
      const invalidPoints = [
        createPointInfo({ mapPointId: createOpaqueId(161) }),
        createPointInfo({ title: "T".repeat(181) }),
        createPointInfo({ workHours: "W".repeat(121) }),
      ];

      for (const point of invalidPoints) {
        await assert.rejects(
          createLogisticsServiceReturning({
            points: [point],
          }).getPickupPointsByIds(["requested-point"]),
          (error) =>
            error instanceof BadGatewayException && error.getStatus() === 502,
        );
      }
    });
  });

  it("accepts explicit empty map arrays but rejects missing or malformed map shapes", async () => {
    await withOzonLogisticsMode("real", async () => {
      for (const response of [{ clusters: [] }, { points: [] }]) {
        const service = createLogisticsServiceReturning(response);

        assert.deepEqual(await service.getMapClusters(createMapRequest()), []);
      }

      for (const response of [
        {},
        { clusters: null },
        { clusters: {} },
        { points: null },
        { points: {} },
        {
          clusters: [
            {
              coordinate: { lat: 55.76, long: 37.61 },
              is_same_building: "true",
              map_point_ids: ["11"],
              points_count: 1,
            },
          ],
        },
        null,
        [],
      ]) {
        const service = createLogisticsServiceReturning(response);

        await assert.rejects(
          service.getMapClusters(createMapRequest()),
          BadGatewayException,
        );
      }
    });
  });

  it("accepts explicit empty point arrays but rejects missing or malformed point shapes", async () => {
    await withOzonLogisticsMode("real", async () => {
      assert.deepEqual(
        await createLogisticsServiceReturning({
          points: [],
        }).getPickupPointsByIds(["11"]),
        [],
      );

      for (const response of [{}, { points: null }, { points: {} }, null, []]) {
        const service = createLogisticsServiceReturning(response);

        await assert.rejects(
          service.getPickupPointsByIds(["11"]),
          BadGatewayException,
        );
      }
    });
  });

  it("fails closed when a selected point has a malformed required contract", async () => {
    await withOzonLogisticsMode("real", async () => {
      const validMethod = {
        address: "Москва, Тверская, 1",
        delivery_type: { id: 1002 },
        map_point_id: "11",
        name: "Ozon ПВЗ",
        work_hours: "09:00-21:00",
      };
      const malformedPoints = [
        {
          enabled: true,
          delivery_method: { ...validMethod, address: "" },
        },
        {
          enabled: true,
          delivery_method: { ...validMethod, name: undefined },
        },
        {
          enabled: true,
          delivery_method: { ...validMethod, work_hours: undefined },
        },
        {
          enabled: "true",
          delivery_method: validMethod,
        },
        {
          enabled: true,
          delivery_method: { ...validMethod, delivery_type: {} },
        },
        {
          enabled: true,
          delivery_method: { ...validMethod, map_point_id: undefined },
        },
      ];

      for (const point of malformedPoints) {
        const service = createLogisticsServiceReturning({ points: [point] });

        await assert.rejects(service.getPickupPoint("11"), BadGatewayException);
      }
    });
  });

  it("rejects excess concurrent requests and releases slots after upstream timeouts", async () => {
    await withOzonLogisticsMode("real", async () => {
      let callCount = 0;
      let shouldTimeout = true;
      let releaseRequests: (() => void) | undefined;
      const requestGate = new Promise<void>((resolve) => {
        releaseRequests = resolve;
      });
      const oauth = {
        requestSellerApi: async () => {
          callCount += 1;
          await requestGate;

          if (shouldTimeout) {
            throw new GatewayTimeoutException(
              "Ozon Seller API request timed out",
            );
          }

          return { clusters: [] };
        },
      } as unknown as OzonOAuthService;
      const service = new OzonLogisticsService(oauth);
      const requests = Array.from(
        { length: ozonSellerApiMaxConcurrentRequests + 1 },
        () => service.getDeliveryMap(createMapRequest()),
      );
      const settledRequests = Promise.allSettled(requests);

      try {
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(callCount, ozonSellerApiMaxConcurrentRequests);
      } finally {
        releaseRequests?.();
      }

      const results = await settledRequests;
      const excessResult = results.at(-1);

      assert.equal(
        results
          .slice(0, -1)
          .every(
            (result) =>
              result.status === "rejected" &&
              result.reason instanceof GatewayTimeoutException,
          ),
        true,
      );
      assert.equal(excessResult?.status, "rejected");
      assert.equal(
        excessResult?.status === "rejected" &&
          excessResult.reason instanceof ServiceUnavailableException,
        true,
      );

      shouldTimeout = false;

      assert.deepEqual(await service.getDeliveryMap(createMapRequest()), {
        clusters: [],
      });
      assert.equal(callCount, ozonSellerApiMaxConcurrentRequests + 1);
    });
  });

  it("validates storefront coordinates, zoom, and string point IDs", () => {
    const safeMapPointId = "90071992547409931234";
    const sellerViewport = {
      left_bottom: { lat: 55.55, long: 37.35 },
      right_top: { lat: 55.95, long: 37.85 },
    };
    const storefrontViewport = {
      leftBottom: { lat: 55.55, long: 37.35 },
      rightTop: { lat: 55.95, long: 37.85 },
    };

    assert.equal(
      validateSync(
        plainToInstance(StorefrontOzonDeliveryMapRequestDTO, {
          viewport: storefrontViewport,
          zoom: 19,
        }),
      ).length,
      0,
    );
    assert.equal(
      validateSync(
        plainToInstance(StorefrontOzonDeliveryPointInfoRequestDTO, {
          mapPointIds: ["11"],
        }),
      ).length,
      0,
    );
    assert.equal(
      validateSync(
        plainToInstance(OzonDeliveryPointInfoRequestDTO, {
          map_point_ids: [safeMapPointId],
        }),
      ).length,
      0,
    );
    assert.equal(
      validateSync(
        plainToInstance(OzonDeliveryMapClusterDTO, {
          cluster_id: "cluster-1",
          coordinate: { lat: 55.7, long: 37.5 },
          count: 1,
          map_point_ids: [safeMapPointId],
        }),
      ).length,
      0,
    );
    assert.equal(
      validateSync(
        plainToInstance(OzonDeliveryMapPointDTO, {
          available: true,
          coordinate: { lat: 55.7, long: 37.5 },
          map_point_id: safeMapPointId,
          status: "available",
          type: "PVZ",
        }),
      ).length,
      0,
    );

    const invalidRequests: object[] = [
      plainToInstance(OzonDeliveryMapRequestDTO, {
        viewport: sellerViewport,
        zoom: 20,
      }),
      plainToInstance(StorefrontOzonDeliveryMapRequestDTO, {
        viewport: storefrontViewport,
        zoom: 20,
      }),
      plainToInstance(StorefrontOzonDeliveryMapRequestDTO, {
        viewport: {
          ...storefrontViewport,
          leftBottom: { lat: 91, long: 37.35 },
        },
        zoom: 11,
      }),
      plainToInstance(StorefrontOzonDeliveryPointInfoRequestDTO, {
        mapPointIds: [],
      }),
      plainToInstance(OzonDeliveryPointInfoRequestDTO, {
        map_point_ids: [11],
      }),
      plainToInstance(OzonDeliveryMapClusterDTO, {
        cluster_id: "cluster-1",
        coordinate: { lat: 55.7, long: 37.5 },
        count: 1,
        map_point_ids: [11],
      }),
      plainToInstance(OzonDeliveryMapPointDTO, {
        available: true,
        coordinate: { lat: 55.7, long: 37.5 },
        map_point_id: 11,
        status: "available",
        type: "PVZ",
      }),
    ];

    for (const request of invalidRequests) {
      assert.equal(validateSync(request).length > 0, true);
    }
  });

  it("validates persisted pickup snapshot boundaries across inbound and response DTOs", () => {
    const exactId = createOpaqueId(160);
    const oversizedId = createOpaqueId(161);
    const exactTitle = "T".repeat(180);
    const oversizedTitle = "T".repeat(181);
    const exactWorkHours = "W".repeat(120);
    const oversizedWorkHours = "W".repeat(121);
    const validInstances = [
      plainToInstance(StorefrontOzonDeliveryPointInfoRequestDTO, {
        mapPointIds: [exactId],
      }),
      plainToInstance(StorefrontOzonDeliveryMapClusterDTO, {
        coordinate: { lat: 55.7, long: 37.5 },
        isSameBuilding: true,
        mapPointIds: [exactId],
        pointsCount: 1,
      }),
      plainToInstance(OzonDeliveryPointInfoRequestDTO, {
        map_point_ids: [exactId],
      }),
      plainToInstance(OzonDeliveryMapClusterDTO, {
        cluster_id: "cluster-1",
        coordinate: { lat: 55.7, long: 37.5 },
        count: 1,
        map_point_ids: [exactId],
      }),
      plainToInstance(OzonDeliveryMapPointDTO, {
        available: true,
        coordinate: { lat: 55.7, long: 37.5 },
        map_point_id: exactId,
        status: "available",
        type: "PVZ",
      }),
      plainToInstance(OzonDeliveryPointInfoDTO, {
        ...createRawPointInfoDTO(),
        map_point_id: exactId,
        name: exactTitle,
        work_hours: exactWorkHours,
      }),
      plainToInstance(CreateOrderDeliveryRequestDTO, {
        pickupPointId: exactId,
        provider: "ozon",
      }),
      plainToInstance(DeliveryPickupPointDTO, {
        address: "Москва, Тверская, 1",
        deliveryPrice: 200,
        id: exactId,
        title: exactTitle,
        workHours: exactWorkHours,
      }),
      plainToInstance(PickupPointDTO, {
        address: "Москва, Тверская, 1",
        deliveryPrice: 200,
        id: exactId,
        title: exactTitle,
        workHours: exactWorkHours,
      }),
    ];

    for (const instance of validInstances) {
      assert.equal(validateSync(instance).length, 0);
    }

    const invalidInstances = [
      plainToInstance(StorefrontOzonDeliveryPointInfoRequestDTO, {
        mapPointIds: [oversizedId],
      }),
      plainToInstance(StorefrontOzonDeliveryMapClusterDTO, {
        coordinate: { lat: 55.7, long: 37.5 },
        isSameBuilding: true,
        mapPointIds: [oversizedId],
        pointsCount: 1,
      }),
      plainToInstance(OzonDeliveryPointInfoRequestDTO, {
        map_point_ids: [oversizedId],
      }),
      plainToInstance(OzonDeliveryMapClusterDTO, {
        cluster_id: "cluster-1",
        coordinate: { lat: 55.7, long: 37.5 },
        count: 1,
        map_point_ids: [oversizedId],
      }),
      plainToInstance(OzonDeliveryMapPointDTO, {
        available: true,
        coordinate: { lat: 55.7, long: 37.5 },
        map_point_id: oversizedId,
        status: "available",
        type: "PVZ",
      }),
      plainToInstance(OzonDeliveryPointInfoDTO, {
        ...createRawPointInfoDTO(),
        map_point_id: oversizedId,
      }),
      plainToInstance(OzonDeliveryPointInfoDTO, {
        ...createRawPointInfoDTO(),
        name: oversizedTitle,
      }),
      plainToInstance(OzonDeliveryPointInfoDTO, {
        ...createRawPointInfoDTO(),
        work_hours: oversizedWorkHours,
      }),
      plainToInstance(CreateOrderDeliveryRequestDTO, {
        pickupPointId: oversizedId,
        provider: "ozon",
      }),
      plainToInstance(DeliveryPickupPointDTO, {
        address: "Москва, Тверская, 1",
        deliveryPrice: 200,
        id: oversizedId,
        title: exactTitle,
        workHours: exactWorkHours,
      }),
      plainToInstance(DeliveryPickupPointDTO, {
        address: "Москва, Тверская, 1",
        deliveryPrice: 200,
        id: exactId,
        title: oversizedTitle,
        workHours: exactWorkHours,
      }),
      plainToInstance(DeliveryPickupPointDTO, {
        address: "Москва, Тверская, 1",
        deliveryPrice: 200,
        id: exactId,
        title: exactTitle,
        workHours: oversizedWorkHours,
      }),
      plainToInstance(PickupPointDTO, {
        address: "Москва, Тверская, 1",
        deliveryPrice: 200,
        id: oversizedId,
        title: exactTitle,
        workHours: exactWorkHours,
      }),
    ];

    for (const instance of invalidInstances) {
      assert.equal(validateSync(instance).length > 0, true);
    }
  });
});

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

function createLogisticsServiceReturning(response: unknown) {
  return new OzonLogisticsService({
    requestSellerApi: async () => response,
  } as unknown as OzonOAuthService);
}

function createMapRequest() {
  return {
    viewport: {
      left_bottom: { lat: 55.55, long: 37.35 },
      right_top: { lat: 55.95, long: 37.85 },
    },
    zoom: 11,
  };
}

function createOpaqueId(length: number, prefix = " Ozon/opaque:001-") {
  const suffix = " ";

  return `${prefix}${"x".repeat(length - prefix.length - suffix.length)}${suffix}`;
}

function createPointInfo(
  overrides: {
    mapPointId?: string;
    title?: string;
    workHours?: string;
  } = {},
) {
  return {
    enabled: true,
    delivery_method: {
      address: "Москва, Тверская, 1",
      delivery_type: { id: 1002 },
      map_point_id: overrides.mapPointId ?? "point-1",
      name: overrides.title ?? "Ozon ПВЗ",
      work_hours: overrides.workHours ?? "09:00-21:00",
    },
  };
}

function createRawPointInfoDTO() {
  return {
    address: "Москва, Тверская, 1",
    available: true,
    available_delivery_methods: ["pickup"],
    city: "Москва",
    coordinate: { lat: 55.7, long: 37.5 },
    delivery_price: 200,
    delivery_term_days: 1,
    external_id: "external-1",
    how_to_get: "Вход со двора",
    map_point_id: "point-1",
    name: "Ozon ПВЗ",
    payment_methods: ["online_card"],
    restrictions: {
      max_dimensions_cm: { depth: 1, height: 1, width: 1 },
      max_weight_g: 1,
      notes: [],
    },
    status: "available",
    type: "PVZ",
    work_hours: "09:00-21:00",
  };
}
