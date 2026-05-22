import type { DeliveryPickupPointDTO } from "@/shared/actions/delivery";

export function filterPickupPoints(points: DeliveryPickupPointDTO[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");

  if (!normalizedQuery) {
    return points;
  }

  return points.filter((point) =>
    [point.title, point.address, point.workHours]
      .join(" ")
      .toLocaleLowerCase("ru-RU")
      .includes(normalizedQuery),
  );
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
