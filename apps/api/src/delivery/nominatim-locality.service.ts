import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";

import type { CdekCityDetailsDTO } from "./dto";
import {
  DeliveryCacheRepository,
  NominatimGateBusyError,
} from "./delivery-cache.repository";
import {
  AmbiguousLocalityBoundaryError,
  MissingLocalityBoundaryError,
  selectLocalityBoundary,
  validateBoundary,
  type ValidatedLocalityBoundary,
} from "./nominatim-geometry";

const defaultBaseUrl = "https://nominatim.openstreetmap.org";
const defaultUserAgent = "Artmate delivery (https://artmate.ru)";
const responseMaxBytes = 5 * 1024 * 1024;
const requestTimeoutMs = 10_000;
const gateWaitMaxMs = 5_000;
const boundaryFreshTtlMs = 7 * 24 * 60 * 60_000;
const boundaryMaxTtlMs = 30 * 24 * 60 * 60_000;
const negativeTtlMs = 60 * 60_000;

type BoundaryCachePayload =
  | { status: "ok"; boundary: ValidatedLocalityBoundary }
  | { status: "missing" | "ambiguous" };

@Injectable()
export class NominatimLocalityService {
  constructor(private readonly cache: DeliveryCacheRepository) {}

  async resolve(city: CdekCityDetailsDTO): Promise<ValidatedLocalityBoundary> {
    const key = `boundary:cdek:${city.code}`;
    const cached = await this.cache.find(key);
    const now = Date.now();
    if (
      cached?.payload &&
      cached.freshUntil &&
      cached.freshUntil.getTime() > now
    ) {
      return this.parseCachedBoundary(cached.payload);
    }

    const token = crypto.randomUUID();
    if (!(await this.cache.tryAcquireLease(key, token, 30_000))) {
      throw new ServiceUnavailableException(
        "Граница города сейчас определяется. Попробуйте ещё раз.",
      );
    }

    try {
      const boundary = await this.requestBoundary(city);
      if (
        !(await this.cache.publish(
          key,
          token,
          { status: "ok", boundary } satisfies BoundaryCachePayload,
          boundaryFreshTtlMs,
          boundaryMaxTtlMs,
        ))
      ) {
        throw new ServiceUnavailableException(
          "Граница города обновилась в другом запросе. Попробуйте ещё раз.",
        );
      }
      return boundary;
    } catch (error) {
      if (
        error instanceof MissingLocalityBoundaryError ||
        error instanceof AmbiguousLocalityBoundaryError
      ) {
        const status =
          error instanceof AmbiguousLocalityBoundaryError
            ? "ambiguous"
            : "missing";
        if (
          !(await this.cache.publish(
            key,
            token,
            { status } satisfies BoundaryCachePayload,
            negativeTtlMs,
            negativeTtlMs,
          ))
        ) {
          throw new ServiceUnavailableException(
            "Граница города обновилась в другом запросе. Попробуйте ещё раз.",
          );
        }
        throw this.createBoundaryError(status);
      }
      await this.cache.releaseLease(key, token);
      if (
        error instanceof LocalityBoundaryException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      throw new BadGatewayException(
        "Не удалось определить границу города. Попробуйте ещё раз.",
      );
    } finally {
      void this.cache.cleanup().catch(() => undefined);
    }
  }

  private async requestBoundary(city: CdekCityDetailsDTO) {
    const url = this.createSearchUrl(city);
    try {
      return await this.cache.withNominatimGate(async () => {
        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "user-agent":
              process.env.NOMINATIM_USER_AGENT?.trim() || defaultUserAgent,
          },
          redirect: "error",
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
        if (!response.ok) throw new Error("Nominatim request failed");
        const body = await readBoundedResponse(response, responseMaxBytes);
        return selectLocalityBoundary(JSON.parse(body) as unknown, city);
      }, gateWaitMaxMs);
    } catch (error) {
      if (
        error instanceof MissingLocalityBoundaryError ||
        error instanceof AmbiguousLocalityBoundaryError
      )
        throw error;
      if (error instanceof NominatimGateBusyError) {
        throw new ServiceUnavailableException(
          "Сервис границ городов занят. Попробуйте ещё раз.",
        );
      }
      throw new BadGatewayException(
        "Не удалось определить границу города. Попробуйте ещё раз.",
      );
    }
  }

  private createSearchUrl(city: CdekCityDetailsDTO) {
    const configured = process.env.NOMINATIM_BASE_URL?.trim() || defaultBaseUrl;
    let base: URL;
    try {
      base = new URL(configured);
    } catch {
      throw new ServiceUnavailableException(
        "Сервис границ городов настроен некорректно.",
      );
    }
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      throw new ServiceUnavailableException(
        "Сервис границ городов настроен некорректно.",
      );
    }
    const url = new URL(
      "search",
      base.href.endsWith("/") ? base : `${base.href}/`,
    );
    const queryParts = [city.name];
    if (normalizeQueryPart(city.region) !== normalizeQueryPart(city.name))
      queryParts.push(city.region);
    url.search = new URLSearchParams({
      q: queryParts.join(", "),
      countrycodes: "ru",
      format: "jsonv2",
      polygon_geojson: "1",
      addressdetails: "1",
      namedetails: "1",
      "accept-language": "ru",
      limit: "10",
    }).toString();
    return url;
  }

  private parseCachedBoundary(payload: unknown) {
    if (!isRecord(payload) || typeof payload.status !== "string") {
      throw new BadGatewayException("Сохранённая граница города повреждена.");
    }
    if (payload.status === "missing" || payload.status === "ambiguous") {
      throw this.createBoundaryError(payload.status);
    }
    if (payload.status !== "ok")
      throw new BadGatewayException("Сохранённая граница города повреждена.");
    if (!isRecord(payload.boundary))
      throw new BadGatewayException("Сохранённая граница города повреждена.");
    return validateBoundary({
      type: payload.boundary.type,
      coordinates: payload.boundary.coordinates,
    });
  }

  private createBoundaryError(status: "missing" | "ambiguous") {
    return new LocalityBoundaryException(status);
  }
}

export class LocalityBoundaryException extends BadGatewayException {
  constructor(status: "missing" | "ambiguous") {
    super({
      code:
        status === "ambiguous"
          ? "DELIVERY_BOUNDARY_AMBIGUOUS"
          : "DELIVERY_BOUNDARY_MISSING",
      message:
        status === "ambiguous"
          ? "Не удалось однозначно определить границу города. Выберите другой населённый пункт."
          : "Не удалось найти точную границу города. Выберите другой населённый пункт.",
      statusCode: 502,
    });
  }
}

async function readBoundedResponse(response: Response, maxBytes: number) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new BadGatewayException(
      "Сервис границ городов вернул слишком большой ответ.",
    );
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new BadGatewayException(
        "Сервис границ городов вернул слишком большой ответ.",
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeQueryPart(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .trim()
    .replace(/\s+/gu, " ");
}
