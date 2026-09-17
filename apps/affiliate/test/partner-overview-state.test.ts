import assert from "node:assert/strict";
import test from "node:test";

import {
  createPartnerOverviewState,
  partnerOverviewReducer,
} from "../src/features/partner-overview/lib/overview-state.ts";

test("changing period resets code and ledger pagination", () => {
  const paginated = {
    ...createPartnerOverviewState(),
    codePage: 4,
    ledgerPage: 3,
  };

  assert.deepEqual(
    partnerOverviewReducer(paginated, { days: 7, type: "period" }),
    {
      codePage: 1,
      days: 7,
      ledgerPage: 1,
    },
  );
});

test("code and ledger pagination remain independent", () => {
  const initial = createPartnerOverviewState();
  const withCodePage = partnerOverviewReducer(initial, {
    page: 2,
    type: "code-page",
  });

  assert.deepEqual(withCodePage, { codePage: 2, days: 30, ledgerPage: 1 });
  assert.deepEqual(
    partnerOverviewReducer(withCodePage, { page: 3, type: "ledger-page" }),
    { codePage: 2, days: 30, ledgerPage: 3 },
  );
});
