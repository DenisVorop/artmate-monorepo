import type { AnalyticsProduct, AnalyticsProductInput } from "./types";

export function mapAnalyticsProduct(input: AnalyticsProductInput): AnalyticsProduct | null {
  if (!isRecord(input)) {
    return null;
  }

  const id = normalizeRequiredText(input.id);
  const name = normalizeRequiredText(input.name);

  if (!id || !name || !isNonNegativeFiniteNumber(input.price)) {
    return null;
  }

  const quantity = input.quantity ?? 1;

  if (!isPositiveInteger(quantity)) {
    return null;
  }

  const category = normalizeOptionalText(input.category);
  const list = normalizeOptionalText(input.list);
  const position = input.position;

  if (position !== undefined && !isPositiveInteger(position)) {
    return null;
  }

  return {
    id,
    name,
    price: input.price,
    quantity,
    ...(category ? { category } : {}),
    ...(list ? { list } : {}),
    ...(position === undefined ? {} : { position }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRequiredText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
