import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";

import type { PickupPointDTO } from "../orders/dto";

import type {
  OzonDeliveryMapClusterDTO,
  OzonDeliveryMapRequestDTO,
  OzonDeliveryMapResponseDTO,
  OzonDeliveryPointInfoDTO,
  OzonDeliveryPointInfoRequestDTO,
  OzonDeliveryPointInfoResponseDTO,
} from "./dto";
import {
  OZON_MOCK_PICKUP_POINTS,
  type OzonMockPickupPoint,
} from "./ozon-logistics.mock-data";
import { OzonOAuthService } from "./ozon-oauth.service";

type OzonLogisticsMode = "mock" | "real";

const MOCK_RESPONSE_DELAY_MS = 450;
const DEFAULT_MOSCOW_VIEWPORT: OzonDeliveryMapRequestDTO = {
  viewport: {
    left_bottom: {
      lat: 55.55,
      long: 37.35,
    },
    right_top: {
      lat: 55.95,
      long: 37.85,
    },
  },
  zoom: 11,
};

@Injectable()
export class OzonLogisticsService {
  constructor(private readonly ozonOAuthService: OzonOAuthService) {}

  async getDeliveryMap(request: OzonDeliveryMapRequestDTO): Promise<unknown> {
    if (this.getMode() === "real") {
      return this.ozonOAuthService.requestSellerApi(
        "/v1/delivery/map",
        request,
      );
    }

    await this.delayMockResponse();

    return this.getMockDeliveryMap(request);
  }

  async getDeliveryPointInfo(
    request: OzonDeliveryPointInfoRequestDTO,
  ): Promise<unknown> {
    if (this.getMode() === "real") {
      return this.ozonOAuthService.requestSellerApi(
        "/v1/delivery/point/info",
        request,
      );
    }

    await this.delayMockResponse();

    return this.getMockDeliveryPointInfo(request);
  }

  async getPickupPoints(): Promise<PickupPointDTO[]> {
    if (this.getMode() === "mock") {
      return OZON_MOCK_PICKUP_POINTS.filter((point) =>
        this.isMockPointAvailable(point),
      ).map((point) => this.mapMockPointToPickupPoint(point));
    }

    const mapResponse = await this.getDeliveryMap(DEFAULT_MOSCOW_VIEWPORT);
    const mapPointIds = this.extractMapPointIds(mapResponse);

    if (mapPointIds.length === 0) {
      return [];
    }

    const pointInfoResponse = await this.getDeliveryPointInfo({
      map_point_ids: mapPointIds.slice(0, 100),
    });

    return this.mapPointInfoResponseToPickupPoints(pointInfoResponse);
  }

  async getPickupPoint(pickupPointId: string): Promise<PickupPointDTO> {
    if (this.getMode() === "mock") {
      const point = this.findMockPickupPoint(pickupPointId);

      if (!point) {
        throw new BadRequestException({
          message: "Ozon pickup point is invalid",
          code: "INVALID_MAP_POINT_ID",
          pickupPointId,
        });
      }

      if (!this.isMockPointAvailable(point)) {
        throw new BadRequestException({
          message: "Ozon pickup point is unavailable",
          code: "UNAVAILABLE_POINT",
          pickupPointId,
        });
      }

      return this.mapMockPointToPickupPoint(point);
    }

    const mapPointId = this.parseMapPointId(pickupPointId);
    const response = await this.getDeliveryPointInfo({
      map_point_ids: [mapPointId],
    });
    const pickupPoints = this.mapPointInfoResponseToPickupPoints(response);
    const pickupPoint = pickupPoints.find((point) => point.id === pickupPointId);

    if (!pickupPoint) {
      throw new BadGatewayException({
        message: "Ozon Logistics point-info response does not contain point",
        pickupPointId,
      });
    }

    return pickupPoint;
  }

  private getMockDeliveryMap(
    request: OzonDeliveryMapRequestDTO,
  ): OzonDeliveryMapResponseDTO {
    const points = OZON_MOCK_PICKUP_POINTS.filter((point) =>
      this.isPointInsideViewport(point, request),
    );

    return {
      clusters: this.getMockClusters(points, request.zoom),
      points: points.map((point) => ({
        map_point_id: point.mapPointId,
        coordinate: {
          lat: point.lat,
          long: point.long,
        },
        type: point.type,
        status: point.status,
        available: this.isMockPointAvailable(point),
      })),
    };
  }

  private getMockDeliveryPointInfo(
    request: OzonDeliveryPointInfoRequestDTO,
  ): OzonDeliveryPointInfoResponseDTO {
    const points = request.map_point_ids.map((mapPointId) =>
      OZON_MOCK_PICKUP_POINTS.find((point) => point.mapPointId === mapPointId),
    );
    const missingPointIds = request.map_point_ids.filter(
      (_mapPointId, index) => !points[index],
    );

    if (missingPointIds.length > 0) {
      throw new BadRequestException({
        message: "Ozon Logistics point-info request failed",
        code: "INVALID_MAP_POINT_ID",
        map_point_ids: missingPointIds,
      });
    }

    return {
      points: points.map((point) => this.mapMockPointToPointInfo(point)),
    };
  }

  private getMockClusters(
    points: OzonMockPickupPoint[],
    zoom: number,
  ): OzonDeliveryMapClusterDTO[] {
    if (points.length === 0) {
      return [];
    }

    if (zoom >= 13) {
      return points.map((point) => this.createMockCluster(point.externalId, [point]));
    }

    const cityGroups = new Map<string, OzonMockPickupPoint[]>();

    for (const point of points) {
      const group = cityGroups.get(point.city) ?? [];

      group.push(point);
      cityGroups.set(point.city, group);
    }

    return Array.from(cityGroups.entries()).map(([city, cityPoints]) =>
      this.createMockCluster(`mock-${city}`, cityPoints),
    );
  }

  private createMockCluster(
    clusterId: string,
    points: OzonMockPickupPoint[],
  ): OzonDeliveryMapClusterDTO {
    const count = points.length;

    if (count === 0) {
      throw new BadGatewayException("Ozon mock cluster cannot be empty");
    }

    return {
      cluster_id: clusterId,
      coordinate: {
        lat: this.getAverage(points.map((point) => point.lat)),
        long: this.getAverage(points.map((point) => point.long)),
      },
      count,
      map_point_ids: points.map((point) => point.mapPointId),
    };
  }

  private mapMockPointToPointInfo(
    point: OzonMockPickupPoint | undefined,
  ): OzonDeliveryPointInfoDTO {
    if (!point) {
      throw new BadRequestException({
        message: "Ozon pickup point is invalid",
        code: "INVALID_MAP_POINT_ID",
      });
    }

    return {
      map_point_id: point.mapPointId,
      external_id: point.externalId,
      name: point.name,
      type: point.type,
      address: point.address,
      city: point.city,
      coordinate: {
        lat: point.lat,
        long: point.long,
      },
      status: point.status,
      available: this.isMockPointAvailable(point),
      work_hours: point.workHours,
      delivery_price: point.deliveryPrice,
      delivery_term_days: point.deliveryTermDays,
      restrictions: {
        max_weight_g: point.maxWeightGrams,
        max_dimensions_cm: point.maxDimensionsCm,
        notes: point.restrictions,
        ...(!this.isMockPointAvailable(point)
          ? { unavailable_reason: point.restrictions.join("; ") }
          : {}),
      },
      available_delivery_methods: point.availableDeliveryMethods,
      payment_methods: point.paymentMethods,
      how_to_get: point.howToGet,
    };
  }

  private mapMockPointToPickupPoint(point: OzonMockPickupPoint): PickupPointDTO {
    return {
      id: String(point.mapPointId),
      title: point.name,
      address: point.address,
      workHours: point.workHours,
      deliveryPrice: point.deliveryPrice,
    };
  }

  private mapPointInfoResponseToPickupPoints(response: unknown): PickupPointDTO[] {
    const points = this.getPointInfoItems(response);

    return points.map((point) => this.mapUnknownPointInfoToPickupPoint(point));
  }

  private mapUnknownPointInfoToPickupPoint(point: unknown): PickupPointDTO {
    const record = this.toRecord(point);
    const mapPointId =
      this.getNumber(record, "map_point_id") ??
      this.getNumber(record, "mapPointId") ??
      this.getNumber(record, "id");
    const available = this.getBoolean(record, "available");
    const status = this.getString(record, "status");

    if (!mapPointId) {
      throw new BadGatewayException({
        message: "Ozon Logistics point-info item is missing map_point_id",
      });
    }

    if (available === false || status === "temporarily_unavailable") {
      throw new BadRequestException({
        message: "Ozon pickup point is unavailable",
        code: "UNAVAILABLE_POINT",
        pickupPointId: String(mapPointId),
      });
    }

    return {
      id: String(mapPointId),
      title:
        this.getString(record, "name") ??
        this.getString(record, "title") ??
        `Ozon pickup point ${mapPointId}`,
      address:
        this.getString(record, "address") ??
        this.getNestedString(record, ["address", "full_address"]) ??
        "Address is not provided by Ozon",
      workHours:
        this.getString(record, "work_hours") ??
        this.getString(record, "workHours") ??
        "Working hours are not provided by Ozon",
      deliveryPrice: this.getNumber(record, "delivery_price") ?? 0,
    };
  }

  private getPointInfoItems(response: unknown): unknown[] {
    const record = this.toRecord(response);

    return (
      this.getArray(record, "points") ??
      this.getArray(record, "delivery_points") ??
      this.getArray(record, "items") ??
      []
    );
  }

  private extractMapPointIds(response: unknown): number[] {
    const record = this.toRecord(response);
    const ids = new Set<number>();
    const clusters = this.getArray(record, "clusters") ?? [];
    const points = this.getArray(record, "points") ?? [];

    for (const cluster of clusters) {
      const clusterRecord = this.toRecord(cluster);
      const mapPointIds = this.getArray(clusterRecord, "map_point_ids") ?? [];

      for (const mapPointId of mapPointIds) {
        const parsedMapPointId = this.parseOptionalMapPointId(mapPointId);

        if (parsedMapPointId) {
          ids.add(parsedMapPointId);
        }
      }
    }

    for (const point of points) {
      const pointRecord = this.toRecord(point);
      const parsedMapPointId = this.parseOptionalMapPointId(
        pointRecord.map_point_id,
      );

      if (parsedMapPointId) {
        ids.add(parsedMapPointId);
      }
    }

    return Array.from(ids);
  }

  private findMockPickupPoint(pickupPointId: string) {
    const mapPointId = this.parseOptionalMapPointId(pickupPointId);

    return OZON_MOCK_PICKUP_POINTS.find(
      (point) =>
        point.mapPointId === mapPointId || point.externalId === pickupPointId,
    );
  }

  private isPointInsideViewport(
    point: OzonMockPickupPoint,
    request: OzonDeliveryMapRequestDTO,
  ) {
    const minLat = Math.min(
      request.viewport.left_bottom.lat,
      request.viewport.right_top.lat,
    );
    const maxLat = Math.max(
      request.viewport.left_bottom.lat,
      request.viewport.right_top.lat,
    );
    const minLong = Math.min(
      request.viewport.left_bottom.long,
      request.viewport.right_top.long,
    );
    const maxLong = Math.max(
      request.viewport.left_bottom.long,
      request.viewport.right_top.long,
    );

    return (
      point.lat >= minLat &&
      point.lat <= maxLat &&
      point.long >= minLong &&
      point.long <= maxLong
    );
  }

  private isMockPointAvailable(point: OzonMockPickupPoint) {
    return point.status === "available";
  }

  private parseMapPointId(value: string): number {
    const mapPointId = this.parseOptionalMapPointId(value);

    if (!mapPointId) {
      throw new BadRequestException({
        message: "Ozon pickup point id must be a numeric map_point_id",
        code: "INVALID_MAP_POINT_ID",
        pickupPointId: value,
      });
    }

    return mapPointId;
  }

  private parseOptionalMapPointId(value: unknown): number | undefined {
    const parsedValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      return undefined;
    }

    return parsedValue;
  }

  private getMode(): OzonLogisticsMode {
    return process.env.OZON_LOGISTICS_MODE === "real" ? "real" : "mock";
  }

  private async delayMockResponse() {
    await new Promise((resolve) => setTimeout(resolve, MOCK_RESPONSE_DELAY_MS));
  }

  private getAverage(values: number[]) {
    const sum = values.reduce((currentSum, value) => currentSum + value, 0);

    return sum / values.length;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object") {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private getArray(record: Record<string, unknown>, key: string) {
    const value = record[key];

    return Array.isArray(value) ? value : undefined;
  }

  private getString(record: Record<string, unknown>, key: string) {
    const value = record[key];

    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private getNestedString(record: Record<string, unknown>, keys: string[]) {
    let current: unknown = record;

    for (const key of keys) {
      current = this.toRecord(current)[key];
    }

    return typeof current === "string" && current.trim()
      ? current.trim()
      : undefined;
  }

  private getNumber(record: Record<string, unknown>, key: string) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsedValue = Number(value);

      return Number.isFinite(parsedValue) ? parsedValue : undefined;
    }

    return undefined;
  }

  private getBoolean(record: Record<string, unknown>, key: string) {
    const value = record[key];

    return typeof value === "boolean" ? value : undefined;
  }
}
