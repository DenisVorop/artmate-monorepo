import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAnalyticsDate,
  formatFinanceKopecks,
} from "../src/entities/affiliate-finance/lib/formatters.ts";

test("formats analytics calendar dates without host timezone drift", () => {
  assert.equal(formatAnalyticsDate("2026-01-01"), "1 янв.");
  assert.equal(formatAnalyticsDate("2026-12-31"), "31 дек.");
});

test("formats the largest safe integer without losing a kopeck", () => {
  assert.equal(
    formatFinanceKopecks(Number.MAX_SAFE_INTEGER),
    "90 071 992 547 409,91 ₽",
  );
});
