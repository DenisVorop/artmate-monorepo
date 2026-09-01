import assert from "node:assert/strict";
import test from "node:test";

import { clampPartnerApplicationsPage } from "../src/features/partner-applications-management/lib/pagination.ts";

test("partner applications page stays unchanged while it is available", () => {
  assert.equal(clampPartnerApplicationsPage(1, 4), 1);
  assert.equal(clampPartnerApplicationsPage(3, 4), 3);
});

test("partner applications page clamps to the last available page", () => {
  assert.equal(clampPartnerApplicationsPage(4, 3), 3);
  assert.equal(clampPartnerApplicationsPage(2, 1), 1);
});

test("an empty result always falls back to the first page", () => {
  assert.equal(clampPartnerApplicationsPage(3, 0), 1);
});
