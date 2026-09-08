import type { DeliveryPickupPointDTO } from "@/shared/actions/delivery";

type PickupPointSearchIndex = {
  entries: Array<{ point: DeliveryPickupPointDTO; searchText: string }>;
  points: DeliveryPickupPointDTO[];
};

type GeoPickupPoint = Pick<DeliveryPickupPointDTO, "id" | "latitude" | "longitude"> & {
  latitude: number;
  longitude: number;
};

export function createPickupPointSearchIndex(
  points: DeliveryPickupPointDTO[],
): PickupPointSearchIndex {
  return {
    entries: points.map((point) => ({
      point,
      searchText: [point.title, point.address, point.workHours]
        .join(" ")
        .toLocaleLowerCase("ru-RU"),
    })),
    points,
  };
}

export function searchPickupPointIndex(index: PickupPointSearchIndex, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");

  if (!normalizedQuery) {
    return index.points;
  }

  return index.entries
    .filter((entry) => entry.searchText.includes(normalizedQuery))
    .map((entry) => entry.point);
}

export function isPickupPointSelectionCurrent(
  query: string,
  renderedQuery: string,
  datasetIdentity: string,
  renderedDatasetIdentity: string,
  activeQuery = query,
  activeDatasetIdentity = datasetIdentity,
  pickupPoints?: readonly DeliveryPickupPointDTO[],
  renderedPickupPoints = pickupPoints,
  activePickupPoints = pickupPoints,
) {
  return (
    query === renderedQuery &&
    query === activeQuery &&
    datasetIdentity === renderedDatasetIdentity &&
    datasetIdentity === activeDatasetIdentity &&
    pickupPoints === renderedPickupPoints &&
    pickupPoints === activePickupPoints
  );
}

export function getPickupPointNavigationIndex(
  currentIndex: number,
  key: "ArrowDown" | "ArrowUp" | "End" | "Home",
  itemCount: number,
) {
  if (itemCount === 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  if (key === "ArrowDown") return Math.min(currentIndex + 1, itemCount - 1);
  if (currentIndex < 0) return itemCount - 1;
  return Math.max(currentIndex - 1, 0);
}

export function includeActivePickupPoint(
  indexes: number[],
  activeIndex: number,
  itemCount = Number.POSITIVE_INFINITY,
) {
  const validIndexes = indexes.filter(
    (index) => Number.isInteger(index) && index >= 0 && index < itemCount,
  );
  if (activeIndex < 0 || activeIndex >= itemCount || validIndexes.includes(activeIndex)) {
    return validIndexes;
  }
  return [...validIndexes, activeIndex].sort((left, right) => left - right);
}

export function getPickupPointsFitKey(
  fitPoints: boolean,
  initialLatitude: number | undefined,
  initialLongitude: number | undefined,
  geoPoints: readonly GeoPickupPoint[],
) {
  if (!fitPoints) return undefined;

  const points = geoPoints
    .map((point) => [point.id, point.latitude, point.longitude] as const)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));

  return JSON.stringify([initialLatitude, initialLongitude, points]);
}

export function formatPickupPointCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} пункт`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} пункта`;
  }

  return `${count} пунктов`;
}
