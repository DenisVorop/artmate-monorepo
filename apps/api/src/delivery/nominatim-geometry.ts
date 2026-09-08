export type Position = readonly [longitude: number, latitude: number];
export type Polygon = readonly (readonly Position[])[];
export type MultiPolygon = readonly Polygon[];

export type ValidatedLocalityBoundary = {
  bbox: readonly [
    minLongitude: number,
    minLatitude: number,
    maxLongitude: number,
    maxLatitude: number,
  ];
  coordinates: MultiPolygon;
  type: "MultiPolygon";
};

type NominatimLocality = {
  address?: Record<string, unknown>;
  addresstype?: unknown;
  category?: unknown;
  display_name?: unknown;
  geojson?: unknown;
  namedetails?: Record<string, unknown>;
  name?: unknown;
  place_rank?: unknown;
  type?: unknown;
};

const maxVertices = 100_000;
const maxPolygons = 2_000;
const maxRings = 10_000;
const localityAddressTypes = new Set([
  "city",
  "town",
  "village",
  "hamlet",
  "isolated_dwelling",
]);

export class InvalidLocalityBoundaryError extends Error {}
export class MissingLocalityBoundaryError extends Error {}
export class AmbiguousLocalityBoundaryError extends Error {}

export function selectLocalityBoundary(
  response: unknown,
  locality: { name: string; latitude: number; longitude: number },
): ValidatedLocalityBoundary {
  if (!Array.isArray(response) || response.length > 10) {
    throw new InvalidLocalityBoundaryError("Invalid Nominatim result list");
  }

  const expectedName = normalizeRussianLocalityName(locality.name);
  const matches: ValidatedLocalityBoundary[] = [];

  for (const value of response) {
    if (!isRecord(value)) continue;
    const candidate = value as NominatimLocality;
    const countryCode = candidate.address?.country_code;
    const addresstype = candidate.addresstype;
    const placeRank = candidate.place_rank;

    if (
      countryCode !== "ru" ||
      candidate.category !== "place" ||
      candidate.type !== addresstype ||
      typeof addresstype !== "string" ||
      !localityAddressTypes.has(addresstype) ||
      typeof placeRank !== "number" ||
      !Number.isInteger(placeRank) ||
      placeRank < 12 ||
      placeRank > 22 ||
      !getCandidateNames(candidate).some(
        (name) => normalizeRussianLocalityName(name) === expectedName,
      )
    ) {
      continue;
    }

    let boundary: ValidatedLocalityBoundary;
    try {
      boundary = validateBoundary(candidate.geojson);
    } catch {
      continue;
    }

    if (containsPoint(boundary, locality.longitude, locality.latitude)) {
      matches.push(boundary);
    }
  }

  if (matches.length === 0) throw new MissingLocalityBoundaryError();
  if (matches.length !== 1) throw new AmbiguousLocalityBoundaryError();
  return matches[0]!;
}

export function validateBoundary(value: unknown): ValidatedLocalityBoundary {
  if (
    !isRecord(value) ||
    (value.type !== "Polygon" && value.type !== "MultiPolygon")
  ) {
    throw new InvalidLocalityBoundaryError("Boundary is not a polygon");
  }

  const rawPolygons =
    value.type === "Polygon" ? [value.coordinates] : value.coordinates;
  if (
    !Array.isArray(rawPolygons) ||
    rawPolygons.length === 0 ||
    rawPolygons.length > maxPolygons
  ) {
    throw new InvalidLocalityBoundaryError("Invalid polygon collection");
  }

  let vertices = 0;
  let rings = 0;
  let minLongitude = Infinity;
  let minLatitude = Infinity;
  let maxLongitude = -Infinity;
  let maxLatitude = -Infinity;
  const coordinates: Position[][][] = [];

  for (const rawPolygon of rawPolygons) {
    if (!Array.isArray(rawPolygon) || rawPolygon.length === 0) {
      throw new InvalidLocalityBoundaryError("Polygon has no rings");
    }
    const polygon: Position[][] = [];
    for (const rawRing of rawPolygon) {
      rings += 1;
      if (rings > maxRings || !Array.isArray(rawRing) || rawRing.length < 4) {
        throw new InvalidLocalityBoundaryError("Invalid polygon ring");
      }
      const ring: Position[] = rawRing.map((rawPosition) => {
        vertices += 1;
        if (
          vertices > maxVertices ||
          !Array.isArray(rawPosition) ||
          rawPosition.length !== 2
        ) {
          throw new InvalidLocalityBoundaryError("Invalid boundary position");
        }
        const [longitude, latitude] = rawPosition;
        if (
          typeof longitude !== "number" ||
          !Number.isFinite(longitude) ||
          longitude < -180 ||
          longitude > 180 ||
          typeof latitude !== "number" ||
          !Number.isFinite(latitude) ||
          latitude < -90 ||
          latitude > 90
        ) {
          throw new InvalidLocalityBoundaryError("Invalid boundary coordinate");
        }
        minLongitude = Math.min(minLongitude, longitude);
        minLatitude = Math.min(minLatitude, latitude);
        maxLongitude = Math.max(maxLongitude, longitude);
        maxLatitude = Math.max(maxLatitude, latitude);
        return [longitude, latitude] as const;
      });
      const first = ring[0]!;
      const last = ring[ring.length - 1]!;
      if (
        first[0] !== last[0] ||
        first[1] !== last[1] ||
        ringArea(ring) === 0
      ) {
        throw new InvalidLocalityBoundaryError(
          "Boundary ring is open or has zero area",
        );
      }
      polygon.push(ring);
    }
    coordinates.push(polygon);
  }

  return {
    bbox: [minLongitude, minLatitude, maxLongitude, maxLatitude],
    coordinates,
    type: "MultiPolygon",
  };
}

export function containsPoint(
  boundary: ValidatedLocalityBoundary,
  longitude: number,
  latitude: number,
) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return false;
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = boundary.bbox;
  if (
    longitude < minLongitude ||
    longitude > maxLongitude ||
    latitude < minLatitude ||
    latitude > maxLatitude
  ) {
    return false;
  }

  return boundary.coordinates.some((polygon) => {
    const outer = pointInRing(polygon[0]!, longitude, latitude);
    if (outer === "outside") return false;
    if (outer === "boundary") return true;
    return !polygon
      .slice(1)
      .some((hole) => pointInRing(hole, longitude, latitude) !== "outside");
  });
}

export function normalizeRussianLocalityName(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .trim()
    .replace(/\s+/gu, " ");
}

function getCandidateNames(candidate: NominatimLocality) {
  // Match the object itself, never address.city of a district inside that city.
  // Administrative municipalities may share a city's name/rank and are not its footprint.
  const names = [
    candidate.name,
    candidate.namedetails?.name,
    candidate.namedetails?.["name:ru"],
  ];
  return names.filter(
    (value): value is string =>
      typeof value === "string" && Boolean(value.trim()),
  );
}

function ringArea(ring: readonly Position[]) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index]!;
    const next = ring[index + 1]!;
    area += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(area / 2);
}

function pointInRing(ring: readonly Position[], x: number, y: number) {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const a = ring[index]!;
    const b = ring[previous]!;
    if (isPointOnSegment(x, y, a, b)) return "boundary" as const;
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      inside = !inside;
    }
  }
  return inside ? ("inside" as const) : ("outside" as const);
}

function isPointOnSegment(x: number, y: number, a: Position, b: Position) {
  const cross = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
  if (Math.abs(cross) > Number.EPSILON * 32) return false;
  return (
    x >= Math.min(a[0], b[0]) &&
    x <= Math.max(a[0], b[0]) &&
    y >= Math.min(a[1], b[1]) &&
    y <= Math.max(a[1], b[1])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
