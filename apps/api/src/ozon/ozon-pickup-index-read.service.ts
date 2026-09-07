import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";

import { ozonDeliveryPriceRub } from "../delivery/delivery.constants";
import { OZON_MOCK_PICKUP_POINTS } from "./ozon-logistics.mock-data";
import {
  OzonPickupIndexRepository,
  type OzonPickupIndexLocality,
  type OzonPickupIndexPoint,
  type OzonPickupPublishedGeneration,
} from "./ozon-pickup-index.repository";
import {
  getOzonPickupLocalityCacheState,
  normalizeOzonLocalityValue,
  ozonPickupLocalityValueMaxLength,
} from "./ozon-pickup-index.policy";

export interface OzonPickupIndexReadRepositoryPort {
  getDatabaseNow(): Promise<Date>;
  getLatestPublished(): Promise<OzonPickupPublishedGeneration | null>;
  findPublishedLocalities(
    generationId: string,
    normalizedPrefix: string,
  ): Promise<OzonPickupIndexLocality[]>;
  findPublishedPickupPoints(
    generationId: string,
    localityId: string,
  ): Promise<OzonPickupIndexPoint[]>;
}

const mockLocalities = [
  {
    id: "mock:ru:moscow",
    name: "Москва",
    region: "Москва",
    countryCode: "RU",
  },
  {
    id: "mock:ru:spb",
    name: "Санкт-Петербург",
    region: "Санкт-Петербург",
    countryCode: "RU",
  },
] as const;

@Injectable()
export class OzonPickupIndexReadService {
  constructor(
    @Inject(OzonPickupIndexRepository)
    private readonly repository: OzonPickupIndexReadRepositoryPort,
  ) {}

  async searchCities(query: string) {
    const trimmedQuery = query.normalize("NFKC").trim();
    if (trimmedQuery.length < 2) return [];
    if (trimmedQuery.length > ozonPickupLocalityValueMaxLength) {
      throw new BadRequestException("Ozon city query is too long");
    }
    const normalizedQuery = normalizeOzonLocalityValue(trimmedQuery).normalized;

    if (normalizedQuery.length < 2) return [];

    if (this.isMockMode()) {
      return mockLocalities.filter((locality) =>
        normalizeOzonLocalityValue(locality.name).normalized.startsWith(
          normalizedQuery,
        ),
      );
    }

    const generation = await this.getReadableGeneration();
    return this.repository.findPublishedLocalities(
      generation.id,
      normalizedQuery,
    );
  }

  async getPickupPoints(localityId: string) {
    if (this.isMockMode()) return this.getMockPickupPoints(localityId);

    const generation = await this.getReadableGeneration();
    const points = await this.repository.findPublishedPickupPoints(
      generation.id,
      localityId,
    );

    return points.map(addStorefrontPrice);
  }

  private async getReadableGeneration() {
    const [now, generation] = await Promise.all([
      this.repository.getDatabaseNow(),
      this.repository.getLatestPublished(),
    ]);

    if (
      !generation ||
      getOzonPickupLocalityCacheState(generation.publishedAt, now) === "expired"
    ) {
      throw new ServiceUnavailableException(
        "Ozon pickup-point index is unavailable",
      );
    }

    return generation;
  }

  private getMockPickupPoints(localityId: string) {
    const locality = mockLocalities.find((item) => item.id === localityId);
    if (!locality) return [];

    return OZON_MOCK_PICKUP_POINTS.filter(
      (point) =>
        point.city === locality.name &&
        point.type === "PVZ" &&
        point.status === "available",
    ).map((point) =>
      addStorefrontPrice({
        id: String(point.mapPointId),
        title: point.name,
        address: point.address,
        workHours: point.workHours,
        latitude: point.lat,
        longitude: point.long,
      }),
    );
  }

  private isMockMode() {
    return process.env.OZON_LOGISTICS_MODE !== "real";
  }
}

function addStorefrontPrice(point: OzonPickupIndexPoint) {
  return {
    ...point,
    deliveryPrice: ozonDeliveryPriceRub,
    minimumDeliveryPrice: ozonDeliveryPriceRub,
  };
}
