import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

import { OzonLogisticsService } from "../ozon/ozon-logistics.service";
import { OZON_MOCK_PICKUP_POINTS } from "../ozon/ozon-logistics.mock-data";
import type { OzonPickupListItem } from "../ozon/ozon-pickup.adapter";

import { ozonDeliveryPriceRub } from "./delivery.constants";
import { DeliveryCacheRepository } from "./delivery-cache.repository";
import type { CdekCityDetailsDTO, DeliveryPickupPointDTO } from "./dto";
import { containsPoint } from "./nominatim-geometry";
import { NominatimLocalityService } from "./nominatim-locality.service";
import { LocalityBoundaryException } from "./nominatim-locality.service";

const freshTtlMs = 7 * 24 * 60 * 60_000;
const maxTtlMs = 30 * 24 * 60 * 60_000;
const cityLeaseMs = 10 * 60_000;
const waitMaxMs = 5_000;
const pointInfoBatchSize = 100;
const pointInfoConcurrency = 2;

type BuildStage = "locality-boundary" | "point-list" | "point-info" | "publish";

@Injectable()
export class OzonCityPickupPointsService {
  private readonly logger = new Logger(OzonCityPickupPointsService.name);

  constructor(
    private readonly cache: DeliveryCacheRepository,
    private readonly logistics: OzonLogisticsService,
    private readonly nominatim: NominatimLocalityService,
  ) {}

  async getPickupPoints(
    city: CdekCityDetailsDTO,
  ): Promise<DeliveryPickupPointDTO[]> {
    if (process.env.OZON_LOGISTICS_MODE !== "real")
      return this.getMockPoints(city);
    void this.cache.cleanup().catch(() => undefined);

    const key = `ozon:city:${city.code}`;
    const cached = await this.getUsablePoints(key);
    if (cached?.state === "fresh") return cached.points;
    if (cached?.state === "stale") {
      void this.refresh(key, city).catch(() => undefined);
      return cached.points;
    }

    const deadline = Date.now() + waitMaxMs;
    while (Date.now() < deadline) {
      if (await this.refresh(key, city)) {
        const published = await this.getUsablePoints(key);
        if (published) return published.points;
      }
      await delay(100);
      const published = await this.getUsablePoints(key);
      if (published) return published.points;
    }
    throw new ServiceUnavailableException(
      "Пункты Ozon для города загружаются. Попробуйте ещё раз.",
    );
  }

  private async refresh(key: string, city: CdekCityDetailsDTO) {
    const token = crypto.randomUUID();
    if (!(await this.cache.tryAcquireLease(key, token, cityLeaseMs)))
      return false;

    const builderToken = crypto.randomUUID();
    if (
      !(await this.cache.tryAcquireLease(
        "ozon:city-builder",
        builderToken,
        cityLeaseMs,
      ))
    ) {
      await this.cache.releaseLease(key, token);
      return false;
    }

    try {
      const boundary = await runBuildStage("locality-boundary", () =>
        this.nominatim.resolve(city),
      );
      const allPoints = await runBuildStage("point-list", () =>
        this.getPointList(),
      );
      const selected = allPoints.filter((point) =>
        containsPoint(boundary, point.longitude, point.latitude),
      );
      const coordinates = new Map(
        selected.map((point) => [point.mapPointId, point]),
      );
      const batches = chunk(
        selected.map((point) => point.mapPointId),
        pointInfoBatchSize,
      );
      const batchResults = await mapConcurrent(
        batches,
        pointInfoConcurrency,
        (batch, batchIndex) =>
          runBuildStage(
            "point-info",
            () => this.logistics.getDeliveryPointInfoBatch(batch),
            batchIndex,
          ),
      );
      await runBuildStage("publish", async () => {
        const points: DeliveryPickupPointDTO[] = batchResults
          .flat()
          .flatMap((point) => {
            if (!point.eligible) return [];
            const coordinate = coordinates.get(point.mapPointId);
            if (!coordinate)
              throw new Error("Ozon point-info has no selected coordinate");
            return [
              {
                id: point.mapPointId,
                title: point.title,
                address: point.address,
                workHours: point.workHours,
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
                deliveryPrice: ozonDeliveryPriceRub,
                minimumDeliveryPrice: ozonDeliveryPriceRub,
              },
            ];
          });
        points.sort(
          (left, right) =>
            left.address.localeCompare(right.address, "ru") ||
            left.id.localeCompare(right.id),
        );
        if (
          !(await this.cache.publish(key, token, points, freshTtlMs, maxTtlMs))
        ) {
          throw new Error("Ozon city cache lease was lost");
        }
      });
      return true;
    } catch (error) {
      const failure =
        error instanceof OzonCityBuildFailure
          ? error
          : new OzonCityBuildFailure("publish", error);
      this.logger.warn({
        stage: failure.stage,
        cityCode: city.code,
        ...(failure.batchIndex === undefined
          ? {}
          : { batchIndex: failure.batchIndex }),
        errorType: getBuildErrorType(failure.cause),
      });
      await this.cache.releaseLease(key, token);
      if (failure.cause instanceof LocalityBoundaryException)
        throw failure.cause;
      throw new BadGatewayException(
        "Не удалось загрузить пункты Ozon. Попробуйте ещё раз.",
      );
    } finally {
      await this.cache.releaseLease("ozon:city-builder", builderToken);
      void this.cache.cleanup().catch(() => undefined);
    }
  }

  private async getPointList(): Promise<OzonPickupListItem[]> {
    const key = "ozon:point-list";
    const cached = await this.cache.find(key);
    const now = Date.now();
    if (
      cached?.payload &&
      cached.freshUntil &&
      cached.freshUntil.getTime() > now
    ) {
      return parsePointListCache(cached.payload);
    }
    const deadline = Date.now() + waitMaxMs;
    while (Date.now() < deadline) {
      const refreshed = await this.refreshPointList(key);
      if (refreshed) {
        const published = await this.cache.find(key);
        if (
          !published?.payload ||
          !published.freshUntil ||
          published.freshUntil.getTime() <= Date.now()
        ) {
          throw new Error("Ozon point-list cache publication is invalid");
        }
        return parsePointListCache(published.payload);
      }
      await delay(100);
      const published = await this.cache.find(key);
      if (
        published?.payload &&
        published.freshUntil &&
        published.freshUntil.getTime() > Date.now()
      ) {
        return parsePointListCache(published.payload);
      }
    }
    throw new ServiceUnavailableException(
      "Список пунктов Ozon сейчас обновляется.",
    );
  }

  private async refreshPointList(key: string) {
    const token = crypto.randomUUID();
    if (!(await this.cache.tryAcquireLease(key, token, 60_000))) return false;
    try {
      const previous = await this.cache.find(key);
      const points = await this.logistics.getDeliveryPointList();
      if (
        points.length === 0 ||
        (Array.isArray(previous?.payload) &&
          points.length * 2 < previous.payload.length)
      ) {
        throw new Error(
          "Ozon global point list is empty or unexpectedly incomplete",
        );
      }
      return await this.cache.publish(key, token, points, freshTtlMs, maxTtlMs);
    } catch (error) {
      await this.cache.releaseLease(key, token);
      throw error;
    }
  }

  private async getUsablePoints(key: string) {
    const record = await this.cache.find(key);
    const now = Date.now();
    if (
      !record?.payload ||
      !record.expiresAt ||
      record.expiresAt.getTime() <= now
    )
      return null;
    const points = parsePickupPointCache(record.payload);
    return {
      points,
      state:
        record.freshUntil && record.freshUntil.getTime() > now
          ? ("fresh" as const)
          : ("stale" as const),
    };
  }

  private getMockPoints(city: CdekCityDetailsDTO): DeliveryPickupPointDTO[] {
    return OZON_MOCK_PICKUP_POINTS.filter(
      (point) =>
        point.city === city.name &&
        point.type === "PVZ" &&
        point.status === "available",
    ).map((point) => ({
      id: String(point.mapPointId),
      title: point.name,
      address: point.address,
      workHours: point.workHours,
      latitude: point.lat,
      longitude: point.long,
      deliveryPrice: ozonDeliveryPriceRub,
      minimumDeliveryPrice: ozonDeliveryPriceRub,
    }));
  }
}

function parsePointListCache(value: unknown): OzonPickupListItem[] {
  if (!Array.isArray(value)) throw new Error("Invalid Ozon point-list cache");
  return value.map((point) => {
    if (
      !isRecord(point) ||
      typeof point.mapPointId !== "string" ||
      !isCoordinate(point.latitude, -90, 90) ||
      !isCoordinate(point.longitude, -180, 180)
    ) {
      throw new Error("Invalid Ozon point-list cache");
    }
    return {
      mapPointId: point.mapPointId,
      latitude: point.latitude,
      longitude: point.longitude,
    };
  });
}

function parsePickupPointCache(value: unknown): DeliveryPickupPointDTO[] {
  if (!Array.isArray(value)) throw new Error("Invalid Ozon city cache");
  return value.map((point) => {
    if (
      !isRecord(point) ||
      typeof point.id !== "string" ||
      typeof point.title !== "string" ||
      typeof point.address !== "string" ||
      typeof point.workHours !== "string" ||
      point.deliveryPrice !== ozonDeliveryPriceRub ||
      !isCoordinate(point.latitude, -90, 90) ||
      !isCoordinate(point.longitude, -180, 180)
    ) {
      throw new Error("Invalid Ozon city cache");
    }
    return {
      id: point.id,
      title: point.title,
      address: point.address,
      workHours: point.workHours,
      deliveryPrice: point.deliveryPrice,
      ...(typeof point.minimumDeliveryPrice === "number"
        ? { minimumDeliveryPrice: point.minimumDeliveryPrice }
        : {}),
      latitude: point.latitude,
      longitude: point.longitude,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCoordinate(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function chunk<T>(items: readonly T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let next = 0;
  let stopped = false;
  let firstError: unknown;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (!stopped && next < items.length) {
        const index = next++;
        try {
          results[index] = await mapper(items[index]!, index);
        } catch (error) {
          stopped = true;
          firstError ??= error;
        }
      }
    }),
  );
  if (firstError !== undefined) throw firstError;
  return results;
}

class OzonCityBuildFailure extends Error {
  constructor(
    readonly stage: BuildStage,
    readonly cause: unknown,
    readonly batchIndex?: number,
  ) {
    super("Ozon city dataset build failed");
  }
}

async function runBuildStage<T>(
  stage: BuildStage,
  operation: () => Promise<T>,
  batchIndex?: number,
) {
  try {
    return await operation();
  } catch (error) {
    throw new OzonCityBuildFailure(stage, error, batchIndex);
  }
}

function getBuildErrorType(error: unknown) {
  if (error instanceof LocalityBoundaryException) return "locality-boundary";
  if (error instanceof ServiceUnavailableException)
    return "service-unavailable";
  if (error instanceof BadGatewayException) return "bad-gateway";
  if (error instanceof Error) return "error";
  return "unknown";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
