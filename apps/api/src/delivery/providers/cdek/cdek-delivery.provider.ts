import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type {
  DeliveryCartItem,
  DeliveryPickupPoint,
  DeliveryProviderAdapter,
  DeliveryQuote,
  DeliverySelection,
  DeliveryShipmentCreateResult,
  DeliveryShipmentDeleteResult,
  DeliveryShipmentOrder,
} from "../delivery-provider.interface";

import { CdekClientService } from "./cdek-client.service";
import type {
  CdekCalculatorResponse,
  CdekCityResponseItem,
  CdekDeliveryPointResponseItem,
  CdekOrderCreateResponse,
  CdekOrderDeleteResponse,
  CdekOrderInfoResponse,
  CdekOrderRequestInfo,
  CdekOrderStatus,
  CdekSuggestCityResponseItem,
} from "./cdek.types";

const defaultCountryCode = "RU";
const defaultFromCityCode = 44;
const defaultTariffCode = 136;
const defaultItemWeightGrams = 400;
const defaultPackageLengthCm = 40;
const defaultPackageWidthCm = 30;
const defaultPackageHeightCm = 1;
const defaultOrderType = 1;
const maxOrderPackageCount = 255;
const cdekShipmentCutoffHourMsk = 18;
const cdekNextDayShipmentHourMsk = 10;

type MoscowDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

@Injectable()
export class CdekDeliveryProvider implements DeliveryProviderAdapter {
  readonly provider = "cdek" as const;

  constructor(private readonly cdekClient: CdekClientService) {}

  async searchCities(query: string, countryCode = defaultCountryCode) {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return [];
    }

    const cities = await this.cdekClient.request<CdekSuggestCityResponseItem[]>(
      "/v2/location/suggest/cities",
      {
        query: {
          country_code: countryCode,
          name: trimmedQuery,
        },
      },
    );

    return cities
      .map((city) => ({
        code: this.getRequiredNumber(city.code, "CDEK city code"),
        countryCode: this.getString(city.country_code) ?? countryCode,
        name: this.getRequiredString(city.full_name, "CDEK city full_name"),
      }))
      .slice(0, 10);
  }

  async getCity(cityCode: number) {
    const cities = await this.cdekClient.request<CdekCityResponseItem[]>(
      "/v2/location/cities",
      {
        query: {
          code: cityCode,
          country_codes: defaultCountryCode,
          page: 0,
          size: 1,
        },
      },
    );

    if (
      !Array.isArray(cities) ||
      cities.some(
        (item) => !item || typeof item !== "object" || Array.isArray(item),
      )
    ) {
      throw new BadGatewayException("CDEK cities response is invalid");
    }

    const city = cities.find(
      (item) =>
        item.code === cityCode && item.country_code === defaultCountryCode,
    );

    if (!city) {
      throw new NotFoundException("CDEK city not found");
    }

    const latitude = this.getBoundedCoordinate(
      city.latitude,
      -90,
      90,
      "latitude",
    );
    const longitude = this.getBoundedCoordinate(
      city.longitude,
      -180,
      180,
      "longitude",
    );

    return {
      code: cityCode,
      countryCode: defaultCountryCode,
      latitude,
      longitude,
      name: this.getRequiredString(city.city, "CDEK city name"),
      region: this.getRequiredString(city.region, "CDEK city region"),
    };
  }

  async getPickupPoints(cityCode: number) {
    const points = await this.cdekClient.request<
      CdekDeliveryPointResponseItem[]
    >("/v2/deliverypoints", {
      query: {
        city_code: cityCode,
        is_handout: true,
        type: "ALL",
      },
    });

    return points.map((point) => this.mapPickupPoint(point, cityCode));
  }

  async calculatePickupPointDelivery(input: {
    items: DeliveryCartItem[];
    selection: DeliverySelection;
  }): Promise<DeliveryQuote> {
    const cityCode = this.parseCityCode(input.selection.cityCode);
    const pickupPointId = this.parsePickupPointId(
      input.selection.pickupPointId,
    );
    const pickupPoint = await this.getPickupPoint(cityCode, pickupPointId);
    const response = await this.cdekClient.request<CdekCalculatorResponse>(
      "/v2/calculator/tariff",
      {
        method: "POST",
        body: {
          ...(this.getShipmentPointCode()
            ? { shipment_point: this.getShipmentPointCode() }
            : {}),
          date: this.getPlannedShipmentDateTime(),
          delivery_point: pickupPoint.id,
          from_location: {
            code: this.getFromCityCode(),
          },
          packages: this.buildCalculationPackages(input.items),
          tariff_code: this.getTariffCode(),
          to_location: {
            code: cityCode,
          },
          type: this.getOrderType(),
        },
      },
    );
    const deliveryPrice = this.getDeliveryPrice(response);

    return {
      deliveryPrice,
      estimatedDeliveryDateRange: this.getDeliveryDateRange(response),
      pickupPoint: {
        ...pickupPoint,
        deliveryPrice,
      },
      provider: this.provider,
    };
  }

  async createOrder(
    order: DeliveryShipmentOrder,
  ): Promise<DeliveryShipmentCreateResult> {
    if (order.delivery.provider !== this.provider) {
      throw new BadRequestException("Order delivery provider must be cdek");
    }

    const requestPayload = this.buildCreateOrderPayload(order);
    const response = await this.cdekClient.request<CdekOrderCreateResponse>(
      "/v2/orders",
      {
        method: "POST",
        body: requestPayload,
      },
    );
    const request = this.getLastRequest(response.requests);

    return {
      externalUuid: this.getString(response.entity?.uuid),
      requestPayload,
      requestState: this.getString(request?.state),
      requestUuid: this.getString(request?.request_uuid),
      responsePayload: response,
    };
  }

  async getOrder(uuid: string): Promise<DeliveryShipmentCreateResult> {
    const response = await this.cdekClient.request<CdekOrderInfoResponse>(
      `/v2/orders/${encodeURIComponent(uuid)}`,
    );

    return this.mapOrderInfoResponse(response, uuid);
  }

  async getOrderByCdekNumber(
    cdekNumber: string,
  ): Promise<DeliveryShipmentCreateResult> {
    const response = await this.cdekClient.request<CdekOrderInfoResponse>(
      "/v2/orders",
      {
        query: {
          cdek_number: this.getRequiredString(cdekNumber, "CDEK order number"),
        },
      },
    );
    const shipment = this.mapOrderInfoResponse(response);

    if (!shipment.externalUuid) {
      throw new BadGatewayException("CDEK order uuid is missing");
    }

    return shipment;
  }

  async deleteOrder(uuid: string): Promise<DeliveryShipmentDeleteResult> {
    const trimmedUuid = this.getRequiredString(uuid, "CDEK order uuid");
    const response = await this.cdekClient.request<CdekOrderDeleteResponse>(
      `/v2/orders/${encodeURIComponent(trimmedUuid)}`,
      {
        method: "DELETE",
      },
    );
    const request = this.getLastRequest(response.requests);

    return {
      externalUuid: this.getString(response.entity?.uuid) ?? trimmedUuid,
      requestState: this.getString(request?.state),
      requestUuid: this.getString(request?.request_uuid),
      responsePayload: response,
    };
  }

  private mapOrderInfoResponse(
    response: CdekOrderInfoResponse,
    fallbackUuid?: string,
  ): DeliveryShipmentCreateResult {
    const request = this.getLastRequest(response.requests);
    const status = this.getLatestStatus(response.entity?.statuses);

    return {
      externalNumber: this.getString(response.entity?.cdek_number),
      externalUuid: this.getString(response.entity?.uuid) ?? fallbackUuid,
      requestState: this.getString(request?.state),
      requestUuid: this.getString(request?.request_uuid),
      responsePayload: response,
      statusCode: this.getString(status?.code),
      statusName: this.getString(status?.name),
    };
  }

  private async getPickupPoint(cityCode: number, pickupPointId: string) {
    const pickupPoints = await this.getPickupPoints(cityCode);
    const pickupPoint = pickupPoints.find(
      (point) => point.id === pickupPointId,
    );

    if (!pickupPoint) {
      throw new BadRequestException("CDEK pickup point is invalid");
    }

    return pickupPoint;
  }

  private buildCalculationPackages(items: DeliveryCartItem[]) {
    const packageCount = Math.max(
      items.reduce((sum, item) => sum + Math.max(item.quantity, 0), 0),
      1,
    );

    return Array.from({ length: packageCount }, () => this.buildBasePackage());
  }

  private buildBasePackage() {
    return {
      height: this.getPositiveIntegerConfig(
        "CDEK_DEFAULT_PACKAGE_HEIGHT_CM",
        defaultPackageHeightCm,
      ),
      length: this.getPositiveIntegerConfig(
        "CDEK_DEFAULT_PACKAGE_LENGTH_CM",
        defaultPackageLengthCm,
      ),
      // CDEK calculator takes package weight in grams and dimensions in centimeters.
      // Each coloring book is shipped as a separate package with env-tuned defaults.
      weight: this.getPositiveIntegerConfig(
        "CDEK_DEFAULT_ITEM_WEIGHT_GRAMS",
        defaultItemWeightGrams,
      ),
      width: this.getPositiveIntegerConfig(
        "CDEK_DEFAULT_PACKAGE_WIDTH_CM",
        defaultPackageWidthCm,
      ),
    };
  }

  private buildCreateOrderPayload(order: DeliveryShipmentOrder) {
    return this.omitUndefined({
      comment: this.truncateOptionalString(order.comment, 255),
      date: this.getPlannedShipmentDateTime(),
      delivery_point: this.parsePickupPointId(order.delivery.pickupPoint.id),
      number: this.truncateRequiredString(order.id, 40),
      packages: this.buildOrderPackages(order),
      recipient: {
        email: this.truncateRequiredString(order.customer.email, 255),
        name: this.truncateRequiredString(order.customer.name, 255),
        phones: [
          {
            number: this.truncateRequiredString(
              this.normalizePhone(order.customer.phone),
              24,
            ),
          },
        ],
      },
      shipment_point: this.getRequiredShipmentPointCode(),
      tariff_code: this.getTariffCode(),
      type: this.getOrderType(),
    });
  }

  private buildOrderPackages(order: DeliveryShipmentOrder) {
    const packages: Record<string, unknown>[] = [];

    for (const item of order.items) {
      const quantity = Math.max(item.quantity, 0);

      for (let index = 0; index < quantity; index += 1) {
        packages.push({
          ...this.buildBasePackage(),
          items: [this.buildOrderPackageItem(item)],
          number: this.createPackageNumber(order.id, packages.length + 1),
        });
      }
    }

    if (packages.length === 0) {
      throw new BadRequestException("CDEK order packages are empty");
    }

    if (packages.length > maxOrderPackageCount) {
      throw new BadRequestException(
        `CDEK order packages count must be ${maxOrderPackageCount} or less`,
      );
    }

    return packages;
  }

  private buildOrderPackageItem(item: DeliveryCartItem) {
    const weight = this.getPositiveIntegerConfig(
      "CDEK_DEFAULT_ITEM_WEIGHT_GRAMS",
      defaultItemWeightGrams,
    );

    return {
      amount: 1,
      cost: 0,
      name: this.truncateRequiredString(item.title, 255),
      payment: {
        value: 0,
        vat_rate: null,
      },
      ware_key: this.truncateRequiredString(this.getWareKey(item), 50),
      weight,
    };
  }

  private createPackageNumber(orderId: string, packageIndex: number) {
    return this.truncateRequiredString(`${orderId}-${packageIndex}`, 30);
  }

  private getWareKey(item: DeliveryCartItem) {
    const key = item.slug?.trim() || item.id.trim() || item.title.trim();

    return key.replace(/[^\p{L}\p{N}!@"#№$;%^:&?*()_\-+=<>,.{}[\]/ ]/gu, "-");
  }

  private normalizePhone(phone: string) {
    const trimmedPhone = phone.trim();
    const digits = trimmedPhone.replace(/\D/g, "");

    if (trimmedPhone.startsWith("+") && digits) {
      return `+${digits}`;
    }

    return digits || trimmedPhone;
  }

  private getLastRequest(requests: CdekOrderRequestInfo[] | undefined) {
    return requests?.at(-1);
  }

  private getLatestStatus(statuses: CdekOrderStatus[] | undefined) {
    return statuses
      ?.filter((status) => !this.getBoolean(status.deleted))
      .reduce<CdekOrderStatus | undefined>((latestStatus, status) => {
        if (!latestStatus) {
          return status;
        }

        const latestDate = Date.parse(
          this.getString(latestStatus.date_time) ?? "",
        );
        const statusDate = Date.parse(this.getString(status.date_time) ?? "");

        return !Number.isNaN(statusDate) &&
          (Number.isNaN(latestDate) || statusDate > latestDate)
          ? status
          : latestStatus;
      }, undefined);
  }

  private mapPickupPoint(
    point: CdekDeliveryPointResponseItem,
    cityCode: number,
  ): DeliveryPickupPoint {
    const location = this.toRecord(point.location);
    const latitude = this.getNumber(location.latitude);
    const longitude = this.getNumber(location.longitude);

    return this.omitUndefined({
      address:
        this.getString(location.address_full) ??
        this.getString(location.address) ??
        this.getRequiredString(point.name, "CDEK delivery point name"),
      cityCode,
      deliveryPrice: 0,
      id: this.getRequiredString(point.code, "CDEK delivery point code"),
      // CDEK deliverypoints already include PVZ coordinates, so the frontend map
      // can render markers without a separate geocoding API.
      latitude,
      longitude,
      title: this.getRequiredString(point.name, "CDEK delivery point name"),
      workHours: this.getString(point.work_time) ?? "График работы уточняется",
    });
  }

  private getDeliveryPrice(response: CdekCalculatorResponse) {
    const totalSum = this.getNumber(response.total_sum);
    const deliverySum = this.getNumber(response.delivery_sum);
    const value = totalSum ?? deliverySum;

    if (value === undefined) {
      throw new BadGatewayException(
        "CDEK calculator response is missing delivery price",
      );
    }

    return Math.ceil(value);
  }

  private getDeliveryDateRange(response: CdekCalculatorResponse) {
    const range = this.toRecord(response.delivery_date_range);
    const min = this.getDateString(range.min);
    const max = this.getDateString(range.max) ?? min;

    if (!min || !max || min > max) {
      return undefined;
    }

    return { min, max };
  }

  private getPlannedShipmentDateTime(now = new Date()) {
    const moscowNow = this.getMoscowDateTimeParts(now);

    if (moscowNow.hour < cdekShipmentCutoffHourMsk) {
      return this.formatCdekDateTime(moscowNow);
    }

    const nextDayAtShipmentHour = new Date(
      Date.UTC(
        moscowNow.year,
        moscowNow.month - 1,
        moscowNow.day + 1,
        cdekNextDayShipmentHourMsk - 3,
        0,
        0,
      ),
    );

    return this.formatCdekDateTime(
      this.getMoscowDateTimeParts(nextDayAtShipmentHour),
    );
  }

  private getMoscowDateTimeParts(date: Date): MoscowDateTimeParts {
    const formatter = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: "Europe/Moscow",
      year: "numeric",
    });
    const values = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );

    return {
      day: this.getRequiredNumber(values.day, "Moscow day"),
      hour: this.getRequiredNumber(values.hour, "Moscow hour"),
      minute: this.getRequiredNumber(values.minute, "Moscow minute"),
      month: this.getRequiredNumber(values.month, "Moscow month"),
      second: this.getRequiredNumber(values.second, "Moscow second"),
      year: this.getRequiredNumber(values.year, "Moscow year"),
    };
  }

  private formatCdekDateTime(parts: MoscowDateTimeParts) {
    return `${parts.year}-${this.padDatePart(parts.month)}-${this.padDatePart(parts.day)}T${this.padDatePart(parts.hour)}:${this.padDatePart(parts.minute)}:${this.padDatePart(parts.second)}+0300`;
  }

  private padDatePart(value: number) {
    return String(value).padStart(2, "0");
  }

  private parseCityCode(value: unknown) {
    const cityCode = this.getNumber(value);

    if (!cityCode || !Number.isInteger(cityCode) || cityCode <= 0) {
      throw new BadRequestException(
        "delivery.cityCode must be a positive integer",
      );
    }

    return cityCode;
  }

  private parsePickupPointId(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(
        "delivery.pickupPointId must be a non-empty string",
      );
    }

    return value.trim();
  }

  private getFromCityCode() {
    return this.getPositiveIntegerConfig(
      "CDEK_DEFAULT_FROM_CITY_CODE",
      defaultFromCityCode,
    );
  }

  private getTariffCode() {
    return this.getPositiveIntegerConfig(
      "CDEK_DEFAULT_TARIFF_CODE",
      defaultTariffCode,
    );
  }

  private getOrderType() {
    return this.getPositiveIntegerConfig("CDEK_ORDER_TYPE", defaultOrderType);
  }

  private getShipmentPointCode() {
    const value = process.env.CDEK_SHIPMENT_POINT_CODE;

    return value?.trim() || undefined;
  }

  private getRequiredShipmentPointCode() {
    const value = this.getShipmentPointCode();

    if (!value) {
      throw new BadRequestException("CDEK_SHIPMENT_POINT_CODE is required");
    }

    return value;
  }

  private getPositiveIntegerConfig(name: string, fallback: number) {
    const parsedValue = Number(process.env[name] ?? fallback);

    return Number.isInteger(parsedValue) && parsedValue > 0
      ? parsedValue
      : fallback;
  }

  private getRequiredString(value: unknown, field: string) {
    const parsedValue = this.getString(value);

    if (!parsedValue) {
      throw new BadGatewayException(`${field} is missing`);
    }

    return parsedValue;
  }

  private getRequiredNumber(value: unknown, field: string) {
    const parsedValue = this.getNumber(value);

    if (parsedValue === undefined) {
      throw new BadGatewayException(`${field} is missing`);
    }

    return parsedValue;
  }

  private getBoundedCoordinate(
    value: unknown,
    min: number,
    max: number,
    field: string,
  ) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < min ||
      value > max
    ) {
      throw new BadGatewayException(`CDEK city ${field} is invalid`);
    }

    return value;
  }

  private getString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private getDateString(value: unknown) {
    const date = this.getString(value);

    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  }

  private getNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsedValue = Number(value);

      return Number.isFinite(parsedValue) ? parsedValue : undefined;
    }

    return undefined;
  }

  private getBoolean(value: unknown) {
    return typeof value === "boolean" ? value : undefined;
  }

  private truncateRequiredString(value: string, maxLength: number) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new BadRequestException("CDEK order field must be non-empty");
    }

    return trimmedValue.slice(0, maxLength);
  }

  private truncateOptionalString(value: string | undefined, maxLength: number) {
    const trimmedValue = value?.trim();

    return trimmedValue ? trimmedValue.slice(0, maxLength) : undefined;
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  }

  private omitUndefined<T extends Record<string, unknown>>(value: T) {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined),
    ) as T;
  }
}
