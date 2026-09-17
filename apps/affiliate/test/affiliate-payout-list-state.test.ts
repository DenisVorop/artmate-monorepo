import assert from "node:assert/strict";
import test from "node:test";

import {
  getPayoutDisplayState,
  getPayoutTotalPages,
} from "../src/features/affiliate-payouts/lib/list-state.ts";

test("calculates at least one payout history page", () => {
  assert.equal(getPayoutTotalPages(0, 10), 1);
  assert.equal(getPayoutTotalPages(21, 10), 3);
});

test("keeps the last successful summary mounted while another page loads or fails", () => {
  const previous = { canRequest: true, marker: "stable-summary" };

  assert.deepEqual(getPayoutDisplayState(previous, undefined), {
    isSummaryFresh: false,
    summary: previous,
  });
  assert.deepEqual(
    getPayoutDisplayState(previous, {
      summary: { canRequest: false, marker: "fresh-summary" },
    }),
    {
      isSummaryFresh: true,
      summary: { canRequest: false, marker: "fresh-summary" },
    },
  );
});
