import assert from "node:assert/strict";
import { test } from "node:test";
import { ConsentChecks } from "../src/consents/consent-checks";

test("shared consent decisions reject duplicates and malformed values without treating false as acceptance", () => {
  for (const value of [
    null,
    {},
    [{ revisionId: "a", accepted: "true" }],
    [{ revisionId: "a", accepted: true, extra: true }],
    [
      { revisionId: "a", accepted: true },
      { revisionId: "a", accepted: true },
    ],
  ])
    assert.equal(ConsentChecks.decisions(value), null);
  const decisions = ConsentChecks.decisions([
    { revisionId: "a", accepted: false },
  ])!;
  assert.equal(ConsentChecks.revisionsMatch(decisions, ["a"]), true);
  assert.equal(ConsentChecks.allAccepted(decisions, ["a"]), false);
  assert.equal(
    ConsentChecks.allAccepted(
      [{ revisionId: "a", accepted: true }],
      ["a", "b"],
    ),
    false,
  );
  assert.equal(
    ConsentChecks.allAccepted(
      [
        { revisionId: "a", accepted: true },
        { revisionId: "a", accepted: true },
      ],
      ["a", "b"],
    ),
    false,
  );
  assert.equal(
    ConsentChecks.revisionsMatch(
      [{ revisionId: "foreign", accepted: true }],
      ["a"],
    ),
    false,
  );
});
test("validity is supplied by the caller and calendar anniversaries preserve leap-day semantics", () => {
  const start = new Date("2024-02-29T12:34:56Z");
  for (const [years, end] of [
    [1, "2025-02-28T12:34:56.000Z"],
    [4, "2028-02-29T12:34:56.000Z"],
    [15, "2039-02-28T12:34:56.000Z"],
  ] as const)
    assert.equal(
      ConsentChecks.period(start, { years })!.endsAt.toISOString(),
      end,
    );
  for (const years of [0, -1, 1.5, 101, NaN])
    assert.equal(ConsentChecks.period(start, { years }), null);
  assert.equal(start.toISOString(), "2024-02-29T12:34:56.000Z");
});
test("the same identity check refuses missing and future verification", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  assert.equal(
    ConsentChecks.verified(
      { email: "actor@example.test", verifiedAt: now },
      now,
    ),
    true,
  );
  assert.equal(
    ConsentChecks.verified({ email: null, verifiedAt: now }, now),
    false,
  );
  assert.equal(
    ConsentChecks.verified(
      { email: "actor@example.test", verifiedAt: null },
      now,
    ),
    false,
  );
  assert.equal(
    ConsentChecks.verified(
      { email: "actor@example.test", verifiedAt: new Date(now.getTime() + 1) },
      now,
    ),
    false,
  );
});
