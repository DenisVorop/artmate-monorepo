import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseCreatePayoutRequest,
  parseMarkPayoutPaidRequest,
  parseRejectPayoutRequest,
} from "../src/affiliate/payout-request";

const requestId = "00000000-0000-4000-8000-000000000001";

describe("affiliate payout requests", () => {
  it("accepts a safe positive selected amount and fingerprints it", () => {
    const first = parseCreatePayoutRequest({ requestId, amountKopecks: 500_000 });
    const retry = parseCreatePayoutRequest({ requestId, amountKopecks: 500_000 });
    const changed = parseCreatePayoutRequest({ requestId, amountKopecks: 500_001 });

    assert.equal(first.amountKopecks, 500_000);
    assert.equal(first.requestFingerprint, retry.requestFingerprint);
    assert.notEqual(first.requestFingerprint, changed.requestFingerprint);
  });

  it("rejects fractional, non-positive and unsafe selected amounts", () => {
    for (const amountKopecks of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => parseCreatePayoutRequest({ requestId, amountKopecks }));
    }
  });

  it("normalizes paid and rejected payloads before fingerprinting", () => {
    const paid = parseMarkPayoutPaidRequest({
      requestId,
      confirmed: true,
      paidAt: "2026-09-17T10:00:00.000Z",
      reference: "  bank-42  ",
    });
    assert.equal(paid.reference, "bank-42");
    assert.equal(paid.paidAt.toISOString(), "2026-09-17T10:00:00.000Z");
    assert.throws(() =>
      parseMarkPayoutPaidRequest({
        requestId,
        confirmed: false,
        paidAt: "2026-09-17T10:00:00.000Z",
        reference: "bank-42",
      }),
    );
    for (const paidAt of [
      "2026-02-30T10:00:00.000Z",
      "2026-09-17",
      "2026-09-17T10:00:00",
      "not-a-date",
      null,
      true,
    ]) {
      assert.throws(() =>
        parseMarkPayoutPaidRequest({
          requestId,
          confirmed: true,
          paidAt,
          reference: "bank-42",
        }),
      );
    }

    const rejected = parseRejectPayoutRequest({ requestId, reason: "  mismatch  " });
    assert.equal(rejected.reason, "mismatch");
  });
});
