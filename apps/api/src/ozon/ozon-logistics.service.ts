import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

import {
  deliveryPickupPointIdMaxLength,
  deliveryPickupPointTitleMaxLength,
  deliveryPickupPointWorkHoursMaxLength,
  ozonDeliveryPriceRub,
} from "../delivery/delivery.constants";
import type { PickupPointDTO } from "../orders/dto";

import type {
  OzonDeliveryPointInfoDTO,
  OzonDeliveryPointInfoRequestDTO,
  OzonDeliveryPointInfoResponseDTO,
} from "./dto";
import {
  OZON_MOCK_PICKUP_POINTS,
  type OzonMockPickupPoint,
} from "./ozon-logistics.mock-data";
import { ozonSellerApiMaxConcurrentRequests } from "./ozon.constants";
import { OzonOAuthService } from "./ozon-oauth.service";
import {
  parseOzonPickupPointInfo,
  parseOzonPickupPointList,
  type OzonPickupListItem,
  type OzonPickupPointInfoItem,
  validateOzonPickupPointInfoRequest,
} from "./ozon-pickup.adapter";

export type {
  OzonPickupEligiblePointInfo,
  OzonPickupExcludedPointInfo,
  OzonPickupPointInfoItem,
} from "./ozon-pickup.adapter";

type OzonLogisticsMode = "mock" | "real";

const MOCK_RESPONSE_DELAY_MS = 450;

@Injectable()
export class OzonLogisticsService {
  private activeSellerApiRequests = 0;
  private readonly logger = new Logger(OzonLogisticsService.name);

  constructor(private readonly ozonOAuthService: OzonOAuthService) {}

  async getDeliveryPointInfo(
    request: OzonDeliveryPointInfoRequestDTO,
  ): Promise<unknown> {
    if (this.getMode() === "real") {
      return this.requestSellerApi("/v1/delivery/point/info", request);
    }

    await this.delayMockResponse();

    return this.getMockDeliveryPointInfo(request);
  }

  async getDeliveryPointList(): Promise<OzonPickupListItem[]> {
    this.assertDatasetAvailable();

    const response = await this.requestSellerApi("/v1/delivery/point/list", {});

    return parseOzonPickupPointList(response);
  }

  async getDeliveryPointInfoBatch(
    mapPointIds: readonly string[],
  ): Promise<OzonPickupPointInfoItem[]> {
    this.assertDatasetAvailable();

    const validMapPointIds = validateOzonPickupPointInfoRequest(mapPointIds);
    const response = await this.requestSellerApi("/v1/delivery/point/info", {
      map_point_ids: validMapPointIds,
    });

    return parseOzonPickupPointInfo(response, validMapPointIds);
  }

  async getPickupPoint(pickupPointId: string): Promise<PickupPointDTO> {
    if (this.getMode() === "mock") {
      return this.loadPickupPoint(pickupPointId);
    }

    try {
      return await this.loadPickupPoint(pickupPointId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw this.createPublicProviderException(
        error,
        "selected point",
        "Не удалось проверить пункт выдачи Ozon. Попробуйте еще раз.",
      );
    }
  }

  private async loadPickupPoint(
    pickupPointId: string,
  ): Promise<PickupPointDTO> {
    if (this.getMode() === "mock") {
      const point = this.findMockPickupPoint(pickupPointId);

      if (!point) {
        throw new BadRequestException({
          message: "Ozon pickup point is invalid",
          code: "INVALID_MAP_POINT_ID",
          pickupPointId,
        });
      }

      if (point.type !== "PVZ" || !this.isMockPointAvailable(point)) {
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
    const pickupPoint = pickupPoints.find((point) => point.id === mapPointId);

    if (!pickupPoint) {
      throw new BadGatewayException({
        message: "Ozon Logistics point-info response does not contain point",
        pickupPointId: mapPointId,
      });
    }

    return pickupPoint;
  }

  private getMockDeliveryPointInfo(
    request: OzonDeliveryPointInfoRequestDTO,
  ): OzonDeliveryPointInfoResponseDTO {
    const points = request.map_point_ids.map((mapPointId) =>
      OZON_MOCK_PICKUP_POINTS.find(
        (point) =>
          String(point.mapPointId) === mapPointId ||
          point.externalId === mapPointId,
      ),
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
      map_point_id: String(point.mapPointId),
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

  private mapMockPointToPickupPoint(
    point: OzonMockPickupPoint,
  ): PickupPointDTO {
    return {
      id: String(point.mapPointId),
      title: point.name,
      address: point.address,
      workHours: point.workHours,
      deliveryPrice: ozonDeliveryPriceRub,
      latitude: point.lat,
      longitude: point.long,
    };
  }

  private mapPointInfoResponseToPickupPoints(
    response: unknown,
    options: { skipUnavailable?: boolean } = {},
  ): PickupPointDTO[] {
    const points = this.getPointInfoItems(response);

    return points.flatMap((point) => {
      if (!this.isPickupPointDeliveryMethod(point)) {
        return [];
      }

      try {
        return [this.mapUnknownPointInfoToPickupPoint(point)];
      } catch (error) {
        if (options.skipUnavailable && error instanceof BadRequestException) {
          return [];
        }

        throw error;
      }
    });
  }

  private mapUnknownPointInfoToPickupPoint(point: unknown): PickupPointDTO {
    const outerRecord = this.toRecord(point);
    const deliveryMethodRecord = this.toRecord(outerRecord.delivery_method);
    const hasDeliveryMethod = Object.keys(deliveryMethodRecord).length > 0;
    const record = hasDeliveryMethod ? deliveryMethodRecord : outerRecord;
    const mapPointId =
      this.parseExternalMapPointId(record.map_point_id) ??
      this.parseExternalMapPointId(record.mapPointId) ??
      this.parseExternalMapPointId(record.id);
    const available = this.getBoolean(record, "available");
    const enabled = this.getBoolean(outerRecord, "enabled");
    const status = this.getString(record, "status");
    const title =
      this.getString(record, "name") ?? this.getString(record, "title");
    const address =
      this.getString(record, "address") ??
      this.getNestedString(record, ["address", "full_address"]);
    const workHours =
      this.getString(record, "work_hours") ??
      this.getString(record, "workHours") ??
      this.formatWorkingHours(record.working_hours);

    if (
      !mapPointId ||
      !title ||
      !address ||
      !workHours ||
      title.length > deliveryPickupPointTitleMaxLength ||
      workHours.length > deliveryPickupPointWorkHoursMaxLength
    ) {
      throw new BadGatewayException({
        message: "Ozon Logistics point-info item is invalid",
      });
    }

    if (
      (hasDeliveryMethod && enabled === undefined) ||
      (!hasDeliveryMethod && available === undefined)
    ) {
      throw new BadGatewayException({
        message: "Ozon Logistics point-info availability is invalid",
      });
    }

    if (
      enabled === false ||
      available === false ||
      status === "temporarily_unavailable"
    ) {
      throw new BadRequestException({
        message: "Ozon pickup point is unavailable",
        code: "UNAVAILABLE_POINT",
        pickupPointId: mapPointId,
      });
    }

    return {
      id: mapPointId,
      title,
      address,
      workHours,
      deliveryPrice: ozonDeliveryPriceRub,
      ...this.getOptionalPointCoordinates(record),
    };
  }

  private getPointInfoItems(response: unknown): unknown[] {
    const record = this.getUpstreamResponseRecord(response, "point-info");

    if (!Object.hasOwn(record, "points") || !Array.isArray(record.points)) {
      throw new BadGatewayException({
        message: "Ozon Logistics point-info response is invalid",
      });
    }

    return record.points;
  }

  private isPickupPointDeliveryMethod(point: unknown) {
    const record = this.toRecord(point);
    const deliveryMethod = this.toRecord(record.delivery_method);
    const deliveryType = this.toRecord(deliveryMethod.delivery_type);

    if (Object.keys(deliveryMethod).length > 0) {
      if (typeof deliveryType.id !== "number") {
        throw new BadGatewayException({
          message: "Ozon Logistics point-info delivery type is invalid",
        });
      }

      return deliveryType.id === 1002;
    }

    const type = this.getString(record, "type");

    if (type !== "PVZ" && type !== "POSTAMAT") {
      throw new BadGatewayException({
        message: "Ozon Logistics point-info delivery type is invalid",
      });
    }

    return type === "PVZ";
  }

  private findMockPickupPoint(pickupPointId: string) {
    const mapPointId = this.parseOptionalMapPointId(pickupPointId);

    return OZON_MOCK_PICKUP_POINTS.find(
      (point) =>
        point.mapPointId === mapPointId || point.externalId === pickupPointId,
    );
  }

  private getUpstreamResponseRecord(response: unknown, operation: string) {
    if (!response || typeof response !== "object" || Array.isArray(response)) {
      throw new BadGatewayException({
        message: `Ozon Logistics ${operation} response is invalid`,
      });
    }

    return response as Record<string, unknown>;
  }

  private parseMapCoordinate(value: unknown) {
    const coordinate = this.toRecord(value);
    const lat = this.getNumber(coordinate, "lat");
    const long = this.getNumber(coordinate, "long");

    if (
      lat === undefined ||
      long === undefined ||
      lat < -90 ||
      lat > 90 ||
      long < -180 ||
      long > 180
    ) {
      throw new BadGatewayException({
        message: "Ozon Logistics point-info coordinate is invalid",
      });
    }

    return { lat, long };
  }

  private getOptionalPointCoordinates(record: Record<string, unknown>) {
    const value = record.coordinates ?? record.coordinate;

    if (value === undefined || value === null) {
      return {};
    }

    const coordinate = this.parseMapCoordinate(value);

    return {
      latitude: coordinate.lat,
      longitude: coordinate.long,
    };
  }

  private isMockPointAvailable(point: OzonMockPickupPoint) {
    return point.status === "available";
  }

  private parseMapPointId(value: string): string {
    const mapPointId = this.parseExternalMapPointId(value);

    if (!mapPointId) {
      throw new BadRequestException({
        message: "Ozon pickup point id must be a non-empty string",
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

    if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
      return undefined;
    }

    return parsedValue;
  }

  private parseExternalMapPointId(value: unknown): string | undefined {
    if (
      typeof value === "string" &&
      value.trim() &&
      value.length <= deliveryPickupPointIdMaxLength
    ) {
      return value;
    }

    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
      return String(value);
    }

    return undefined;
  }

  private formatWorkingHours(value: unknown) {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const periods = value.flatMap((day) => {
      const dayRecord = this.toRecord(day);
      const dayPeriods = Array.isArray(dayRecord.periods)
        ? dayRecord.periods
        : [];

      return dayPeriods.flatMap((period) => {
        const periodRecord = this.toRecord(period);
        const from = this.formatWorkingTime(periodRecord.min);
        const to = this.formatWorkingTime(periodRecord.max);

        return from && to ? [`${from}-${to}`] : [];
      });
    });

    return periods[0];
  }

  private formatWorkingTime(value: unknown) {
    const record = this.toRecord(value);
    const hours = this.getNumber(record, "hours");
    const minutes = this.getNumber(record, "minutes");

    if (hours === undefined || minutes === undefined) {
      return undefined;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  private getMode(): OzonLogisticsMode {
    return process.env.OZON_LOGISTICS_MODE === "real" ? "real" : "mock";
  }

  private assertDatasetAvailable() {
    if (this.getMode() === "mock") {
      throw new ServiceUnavailableException({
        code: "OZON_PICKUP_DATASET_UNAVAILABLE_IN_MOCK_MODE",
        message: "Ozon pickup dataset is unavailable in mock mode",
      });
    }
  }

  private async requestSellerApi(path: string, body: unknown) {
    if (this.activeSellerApiRequests >= ozonSellerApiMaxConcurrentRequests) {
      throw new ServiceUnavailableException({
        code: "OZON_SELLER_API_CONCURRENCY_LIMIT",
        message: "Ozon delivery service is busy. Try again later",
      });
    }

    this.activeSellerApiRequests += 1;

    try {
      return await this.ozonOAuthService.requestSellerApi(path, body);
    } finally {
      this.activeSellerApiRequests -= 1;
    }
  }

  private createPublicProviderException(
    error: unknown,
    operation: string,
    publicMessage: string,
  ) {
    const status =
      error instanceof HttpException ? error.getStatus() : undefined;
    const diagnostic =
      error instanceof HttpException
        ? error.getResponse()
        : error instanceof Error
          ? { message: error.message, name: error.name }
          : error;

    this.logger.warn(
      `Ozon Logistics ${operation} failed${status ? ` with status ${status}` : ""}: ${this.toLogString(
        this.sanitizeForDiagnostics(diagnostic),
      )}`,
    );

    return new BadGatewayException(
      {
        error: "Bad Gateway",
        message: publicMessage,
        statusCode: 502,
      },
      { cause: this.sanitizeForDiagnostics({ diagnostic, status }) },
    );
  }

  private sanitizeForDiagnostics(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeForDiagnostics(item));
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, propertyValue]) => [
        key,
        /authorization|secret|token|access.?key|request.?sign/iu.test(key)
          ? "[redacted]"
          : this.sanitizeForDiagnostics(propertyValue),
      ]),
    );
  }

  private toLogString(value: unknown) {
    try {
      return JSON.stringify(value).slice(0, 2_000);
    } catch {
      return "[unserializable]";
    }
  }

  private async delayMockResponse() {
    await new Promise((resolve) => setTimeout(resolve, MOCK_RESPONSE_DELAY_MS));
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object") {
      return {};
    }

    return value as Record<string, unknown>;
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
