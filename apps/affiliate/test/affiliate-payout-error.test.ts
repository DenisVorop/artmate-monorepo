import assert from "node:assert/strict";
import test from "node:test";

import { getPayoutErrorMessage } from "../src/features/affiliate-payouts/lib/error-message.ts";

test("uses human messages for auth, access, network, and stable payout conflicts", () => {
  assert.match(getPayoutErrorMessage(401), /войдите/i);
  assert.match(getPayoutErrorMessage(403), /доступ/i);
  assert.match(getPayoutErrorMessage(503), /ответ не получен/i);
  assert.match(
    getPayoutErrorMessage(409, "affiliate_payout_request_conflict"),
    /обновите историю/i,
  );
});
