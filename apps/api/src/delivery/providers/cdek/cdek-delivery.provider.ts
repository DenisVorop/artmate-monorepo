import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";

import type {
  DeliveryCartItem,
  DeliveryPickupPoint,
  DeliveryProviderAdapter,
  DeliveryQuote,
  DeliverySelection,
} from "../delivery-provider.interface";

import { CdekClientService } from "./cdek-client.service";
import type {
  CdekCalculatorResponse,
  CdekDeliveryPointResponseItem,
  CdekSuggestCityResponseItem,
} from "./cdek.types";

const defaultCountryCode = "RU";
const defaultFromCityCode = 44;
const defaultTariffCode = 136;
const defaultItemWeightGrams = 500;
const defaultPackageLengthCm = 30;
const defaultPackageWidthCm = 21;
const defaultPackageHeightCm = 3;

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
          delivery_point: pickupPoint.id,
          from_location: {
            code: this.getFromCityCode(),
          },
          packages: [this.buildPackage(input.items)],
          tariff_code: this.getTariffCode(),
          to_location: {
            code: cityCode,
          },
          type: 1,
        },
      },
    );
    const deliveryPrice = this.getDeliveryPrice(response);

    return {
      deliveryPrice,
      pickupPoint: {
        ...pickupPoint,
        deliveryPrice,
      },
      provider: this.provider,
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

  private buildPackage(items: DeliveryCartItem[]) {
    const totalQuantity = Math.max(
      items.reduce((sum, item) => sum + item.quantity, 0),
      1,
    );

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
      // Product catalog does not store physical dimensions yet, so MVP uses env-tuned defaults.
      weight:
        totalQuantity *
        this.getPositiveIntegerConfig(
          "CDEK_DEFAULT_ITEM_WEIGHT_GRAMS",
          defaultItemWeightGrams,
        ),
      width: this.getPositiveIntegerConfig(
        "CDEK_DEFAULT_PACKAGE_WIDTH_CM",
        defaultPackageWidthCm,
      ),
    };
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

  private getString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
