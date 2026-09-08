import { BadGatewayException, BadRequestException } from "@nestjs/common";

import {
  deliveryPickupPointIdMaxLength,
  deliveryPickupPointTitleMaxLength,
  deliveryPickupPointWorkHoursMaxLength,
} from "../delivery/delivery.constants";
export type OzonPickupListItem = {
  mapPointId: string;
  latitude: number;
  longitude: number;
};

export type OzonPickupExcludedPointInfo = {
  mapPointId: string;
  eligible: false;
  reason: "disabled" | "unsupported_delivery_type";
};

export type OzonPickupEligiblePointInfo = {
  mapPointId: string;
  eligible: true;
  title: string;
  address: string;
  workHours: string;
};

export type OzonPickupPointInfoItem =
  | OzonPickupExcludedPointInfo
  | OzonPickupEligiblePointInfo;

const pointInfoBatchMaxSize = 100;
const staffedPickupPointDeliveryTypeId = 1002;
const unknownWorkingHours = "График работы уточняется";

export function parseOzonPickupPointList(
  response: unknown,
): OzonPickupListItem[] {
  const record = parseResponseRecord(response, "point-list");

  if (!Array.isArray(record.points)) {
    throw createProtocolException("point-list");
  }

  const ids = new Set<string>();

  return record.points.map((point) => {
    const pointRecord = parseItemRecord(point, "point-list");
    const coordinate = parseItemRecord(pointRecord.coordinate, "point-list");
    const mapPointId = parseResponseId(pointRecord.map_point_id, "point-list");
    const latitude = parseCoordinate(coordinate.lat, -90, 90, "point-list");
    const longitude = parseCoordinate(coordinate.long, -180, 180, "point-list");

    if (ids.has(mapPointId)) {
      throw createProtocolException("point-list");
    }

    ids.add(mapPointId);

    return { mapPointId, latitude, longitude };
  });
}

export function validateOzonPickupPointInfoRequest(
  mapPointIds: readonly string[],
): string[] {
  if (
    !Array.isArray(mapPointIds) ||
    mapPointIds.length < 1 ||
    mapPointIds.length > pointInfoBatchMaxSize
  ) {
    throw createRequestException();
  }

  const ids = new Set<string>();

  for (const mapPointId of mapPointIds) {
    if (!isValidStringId(mapPointId) || ids.has(mapPointId)) {
      throw createRequestException();
    }

    ids.add(mapPointId);
  }

  return [...mapPointIds];
}

export function parseOzonPickupPointInfo(
  response: unknown,
  requestedMapPointIds: readonly string[],
): OzonPickupPointInfoItem[] {
  const record = parseResponseRecord(response, "point-info");

  if (!Array.isArray(record.points)) {
    throw createProtocolException("point-info");
  }

  const requestedIds = new Set(requestedMapPointIds);
  const pointsById = new Map<string, OzonPickupPointInfoItem>();

  for (const point of record.points) {
    const pointRecord = parseItemRecord(point, "point-info");
    const deliveryMethod = parseItemRecord(
      pointRecord.delivery_method,
      "point-info",
    );
    const mapPointId = parseResponseId(
      deliveryMethod.map_point_id,
      "point-info",
    );
    const enabled = pointRecord.enabled;

    if (typeof enabled !== "boolean" || pointsById.has(mapPointId)) {
      throw createProtocolException("point-info");
    }

    if (!enabled) {
      pointsById.set(mapPointId, {
        mapPointId,
        eligible: false,
        reason: "disabled",
      });
      continue;
    }

    const deliveryType = parseItemRecord(
      deliveryMethod.delivery_type,
      "point-info",
    );
    const deliveryTypeId = deliveryType.id;

    if (
      typeof deliveryTypeId !== "number" ||
      !Number.isFinite(deliveryTypeId) ||
      !Number.isInteger(deliveryTypeId)
    ) {
      throw createProtocolException("point-info");
    }

    if (deliveryTypeId !== staffedPickupPointDeliveryTypeId) {
      pointsById.set(mapPointId, {
        mapPointId,
        eligible: false,
        reason: "unsupported_delivery_type",
      });
      continue;
    }

    pointsById.set(mapPointId, {
      mapPointId,
      eligible: true,
      title: parseRequiredString(
        deliveryMethod.name,
        deliveryPickupPointTitleMaxLength,
        "point-info",
      ),
      address: parseRequiredString(
        deliveryMethod.address,
        undefined,
        "point-info",
      ),
      workHours: parseOzonWorkingHours(deliveryMethod.working_hours),
    });
  }

  if (
    pointsById.size !== requestedIds.size ||
    [...pointsById.keys()].some((mapPointId) => !requestedIds.has(mapPointId))
  ) {
    throw createProtocolException("point-info");
  }

  return requestedMapPointIds.map((mapPointId) => pointsById.get(mapPointId)!);
}

export function parseOzonWorkingHours(value: unknown) {
  if (!Array.isArray(value)) {
    throw createProtocolException("point-info");
  }

  if (value.length === 0) return unknownWorkingHours;

  let firstPeriod: string | undefined;

  for (const day of value) {
    const dayRecord = parseItemRecord(day, "point-info");

    if (!Array.isArray(dayRecord.periods)) {
      throw createProtocolException("point-info");
    }

    if (dayRecord.periods.length === 0) continue;

    for (const period of dayRecord.periods) {
      const periodRecord = parseItemRecord(period, "point-info");
      const from = parseWorkingTime(periodRecord.min);
      const to = parseWorkingTime(periodRecord.max);

      firstPeriod ??= `${from}-${to}`;
    }
  }

  if (
    !firstPeriod ||
    firstPeriod.length > deliveryPickupPointWorkHoursMaxLength
  ) {
    throw createProtocolException("point-info");
  }

  return firstPeriod;
}

function parseWorkingTime(value: unknown) {
  const record = parseItemRecord(value, "point-info");
  const hours = record.hours;
  const minutes = record.minutes;

  if (
    typeof hours !== "number" ||
    !Number.isInteger(hours) ||
    hours < 0 ||
    hours > 23 ||
    typeof minutes !== "number" ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw createProtocolException("point-info");
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseCoordinate(
  value: unknown,
  min: number,
  max: number,
  operation: "point-list",
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw createProtocolException(operation);
  }

  return value;
}

function parseResponseId(
  value: unknown,
  operation: "point-info" | "point-list",
) {
  if (isValidStringId(value)) {
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }

  throw createProtocolException(operation);
}

function isValidStringId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Boolean(value.trim()) &&
    value.length <= deliveryPickupPointIdMaxLength
  );
}

function parseRequiredString(
  value: unknown,
  maxLength: number | undefined,
  operation: "point-info",
) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    (maxLength !== undefined && value.length > maxLength)
  ) {
    throw createProtocolException(operation);
  }

  return value.trim();
}

function parseResponseRecord(
  value: unknown,
  operation: "point-info" | "point-list",
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createProtocolException(operation);
  }

  return value as Record<string, unknown>;
}

function parseItemRecord(
  value: unknown,
  operation: "point-info" | "point-list",
) {
  return parseResponseRecord(value, operation);
}

function createRequestException() {
  return new BadRequestException({
    message: "Ozon Logistics point-info request is invalid",
  });
}

function createProtocolException(operation: "point-info" | "point-list") {
  return new BadGatewayException({
    message: `Ozon Logistics ${operation} response is invalid`,
  });
}
