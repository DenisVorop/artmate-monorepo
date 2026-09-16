import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDate,
  formatKopecks,
} from "../src/entities/affiliate-partner/lib/formatters.ts";

test("formats payout minimum from integer kopecks", () => {
  assert.equal(formatKopecks(500_000), "5 000 ₽");
  assert.equal(formatKopecks(500_050), "5 000,5 ₽");
});

test("formats ISO contract date for Russian readers without timezone drift", () => {
  assert.equal(formatDate("2026-09-16T00:00:00.000Z"), "16 сентября 2026");
});
