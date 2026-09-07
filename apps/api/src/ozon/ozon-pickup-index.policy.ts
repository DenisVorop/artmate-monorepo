export const ozonPickupSyncIntervalMs = 24 * 60 * 60_000;
export const ozonPickupLocalityFreshTtlMs = 7 * 24 * 60 * 60_000;
export const ozonPickupLocalityStaleTtlMs = 30 * 24 * 60 * 60_000;
export const ozonPickupBuilderLeaseTtlMs = 15 * 60_000;
export const ozonPickupRetryInitialDelayMs = 1_000;
export const ozonPickupRetryMaxDelayMs = 30_000;
export const ozonPickupLocalityValueMaxLength = 160;
export const ozonPickupTransientStatuses = [429, 502, 503, 504] as const;

export type OzonPickupLocalityCacheState = "fresh" | "stale" | "expired";

export type NormalizedOzonLocalityValue = {
  display: string;
  normalized: string;
};

export function isOzonPickupSyncDue(
  publishedAt: Date | null | undefined,
  now: Date,
) {
  return (
    !publishedAt ||
    now.getTime() - publishedAt.getTime() >= ozonPickupSyncIntervalMs
  );
}

export function getOzonPickupLocalityCacheState(
  publishedAt: Date | null | undefined,
  now: Date,
): OzonPickupLocalityCacheState {
  if (!publishedAt) return "expired";

  const ageMs = now.getTime() - publishedAt.getTime();

  if (ageMs < ozonPickupLocalityFreshTtlMs) return "fresh";
  if (ageMs < ozonPickupLocalityStaleTtlMs) return "stale";
  return "expired";
}

export function getOzonPickupBuilderLeaseCutoff(now: Date) {
  return new Date(now.getTime() - ozonPickupBuilderLeaseTtlMs);
}

export function isOzonPickupSourceCountSafe(
  sourceCount: number,
  previousPublishedSourceCount?: number,
) {
  if (!Number.isSafeInteger(sourceCount) || sourceCount <= 0) return false;

  return (
    previousPublishedSourceCount === undefined ||
    previousPublishedSourceCount <= 0 ||
    sourceCount * 2 >= previousPublishedSourceCount
  );
}

export function isOzonPickupTransientStatus(status: number) {
  return (ozonPickupTransientStatuses as readonly number[]).includes(status);
}

export function getOzonPickupRetryDelayMs(attempt: number, jitter: number) {
  if (!Number.isSafeInteger(attempt) || attempt < 0) {
    throw new RangeError("Retry attempt must be a non-negative safe integer");
  }
  if (!Number.isFinite(jitter) || jitter < 0 || jitter > 1) {
    throw new RangeError("Retry jitter must be between 0 and 1");
  }

  const exponentialDelay = Math.min(
    ozonPickupRetryMaxDelayMs,
    ozonPickupRetryInitialDelayMs * 2 ** Math.min(attempt, 30),
  );

  return Math.floor(exponentialDelay * jitter);
}

export function normalizeOzonLocalityValue(
  value: string,
): NormalizedOzonLocalityValue {
  const display = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const normalized = display.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");

  if (
    !display ||
    !normalized ||
    display.length > ozonPickupLocalityValueMaxLength ||
    normalized.length > ozonPickupLocalityValueMaxLength
  ) {
    throw new RangeError(
      "Ozon locality value must be nonblank and at most 160 characters",
    );
  }

  return { display, normalized };
}
