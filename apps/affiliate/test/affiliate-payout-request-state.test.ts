import assert from "node:assert/strict";
import test from "node:test";

import {
  getOrCreatePayoutAttempt,
  shouldRetainPayoutAttempt,
} from "../src/features/affiliate-payouts/lib/request-state.ts";

test("keeps the original id and amount while an attempt is unresolved", () => {
  const original = { amountKopecks: 700_000, requestId: "original-id" };
  let idCalls = 0;

  const result = getOrCreatePayoutAttempt(original, 900_000, () => {
    idCalls += 1;
    return "new-id";
  });

  assert.equal(result, original);
  assert.deepEqual(result, { amountKopecks: 700_000, requestId: "original-id" });
  assert.equal(idCalls, 0);
});

test("creates one request intent when no unresolved attempt exists", () => {
  assert.deepEqual(getOrCreatePayoutAttempt(null, 700_000, () => "new-id"), {
    amountKopecks: 700_000,
    requestId: "new-id",
  });
});

test("retains an attempt only for uncertain server or transport failures", () => {
  assert.equal(shouldRetainPayoutAttempt(503), true);
  assert.equal(shouldRetainPayoutAttempt(500), true);
  assert.equal(shouldRetainPayoutAttempt(409), false);
  assert.equal(shouldRetainPayoutAttempt(403), false);
});
