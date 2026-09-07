import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getOzonPickupBuilderLeaseCutoff,
  getOzonPickupLocalityCacheState,
  getOzonPickupRetryDelayMs,
  isOzonPickupSourceCountSafe,
  isOzonPickupSyncDue,
  isOzonPickupTransientStatus,
  normalizeOzonLocalityValue,
  ozonPickupBuilderLeaseTtlMs,
  ozonPickupLocalityFreshTtlMs,
  ozonPickupLocalityStaleTtlMs,
  ozonPickupRetryMaxDelayMs,
  ozonPickupSyncIntervalMs,
} from "../src/ozon/ozon-pickup-index.policy";

const now = new Date("2026-09-07T12:00:00.000Z");

describe("Ozon pickup-index policy", () => {
  it("requires sync without a publication and at the exact 24-hour boundary", () => {
    assert.equal(isOzonPickupSyncDue(null, now), true);
    assert.equal(
      isOzonPickupSyncDue(
        new Date(now.getTime() - ozonPickupSyncIntervalMs + 1),
        now,
      ),
      false,
    );
    assert.equal(
      isOzonPickupSyncDue(
        new Date(now.getTime() - ozonPickupSyncIntervalMs),
        now,
      ),
      true,
    );
  });

  it("treats a future publication timestamp as fresh", () => {
    assert.equal(isOzonPickupSyncDue(new Date(now.getTime() + 1), now), false);
  });

  it("classifies locality cache age at the exact 7-day and 30-day boundaries", () => {
    assert.equal(getOzonPickupLocalityCacheState(null, now), "expired");
    assert.equal(
      getOzonPickupLocalityCacheState(
        new Date(now.getTime() - ozonPickupLocalityFreshTtlMs + 1),
        now,
      ),
      "fresh",
    );
    assert.equal(
      getOzonPickupLocalityCacheState(
        new Date(now.getTime() - ozonPickupLocalityFreshTtlMs),
        now,
      ),
      "stale",
    );
    assert.equal(
      getOzonPickupLocalityCacheState(
        new Date(now.getTime() - ozonPickupLocalityStaleTtlMs + 1),
        now,
      ),
      "stale",
    );
    assert.equal(
      getOzonPickupLocalityCacheState(
        new Date(now.getTime() - ozonPickupLocalityStaleTtlMs),
        now,
      ),
      "expired",
    );
    assert.equal(
      getOzonPickupLocalityCacheState(new Date(now.getTime() + 1), now),
      "fresh",
    );
  });

  it("uses an exact 15-minute stale builder lease cutoff", () => {
    assert.equal(ozonPickupBuilderLeaseTtlMs, 15 * 60_000);
    assert.equal(
      getOzonPickupBuilderLeaseCutoff(now).toISOString(),
      "2026-09-07T11:45:00.000Z",
    );
  });

  it("accepts only non-empty sources that retain at least half of the previous source", () => {
    assert.equal(isOzonPickupSourceCountSafe(0), false);
    assert.equal(isOzonPickupSourceCountSafe(1), true);
    assert.equal(isOzonPickupSourceCountSafe(49, 100), false);
    assert.equal(isOzonPickupSourceCountSafe(50, 100), true);
    assert.equal(isOzonPickupSourceCountSafe(1, 0), true);
  });

  it("recognizes exactly the configured transient HTTP statuses", () => {
    for (const status of [429, 502, 503, 504]) {
      assert.equal(isOzonPickupTransientStatus(status), true);
    }

    for (const status of [408, 428, 500, 501, 505]) {
      assert.equal(isOzonPickupTransientStatus(status), false);
    }
  });

  it("calculates bounded exponential retry delays through a deterministic jitter seam", () => {
    assert.equal(getOzonPickupRetryDelayMs(0, 0), 0);
    assert.equal(getOzonPickupRetryDelayMs(0, 1), 1_000);
    assert.equal(getOzonPickupRetryDelayMs(3, 1), 8_000);
    assert.equal(
      getOzonPickupRetryDelayMs(Number.MAX_SAFE_INTEGER, 1),
      ozonPickupRetryMaxDelayMs,
    );
    assert.equal(
      getOzonPickupRetryDelayMs(Number.MAX_SAFE_INTEGER, 0.5),
      ozonPickupRetryMaxDelayMs / 2,
    );
    assert.throws(() => getOzonPickupRetryDelayMs(-1, 0.5));
    assert.throws(() => getOzonPickupRetryDelayMs(1, 1.01));
  });

  it("normalizes DB uniqueness while preserving a trimmed display value", () => {
    assert.deepEqual(normalizeOzonLocalityValue("  ЁЛКИ\t  Сити  "), {
      display: "ЁЛКИ Сити",
      normalized: "елки сити",
    });
    assert.deepEqual(normalizeOzonLocalityValue("  Москва\u00a0"), {
      display: "Москва",
      normalized: "москва",
    });
  });

  it("rejects blank or overlong locality display and normalized values", () => {
    assert.throws(() => normalizeOzonLocalityValue(" \t\n "));
    assert.throws(() => normalizeOzonLocalityValue("x".repeat(161)));
    assert.deepEqual(normalizeOzonLocalityValue("x".repeat(160)), {
      display: "x".repeat(160),
      normalized: "x".repeat(160),
    });
  });
});
