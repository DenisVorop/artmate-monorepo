import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../src/shared/lib/api-error.ts";
import { toActionError } from "../src/shared/lib/action-result.ts";

test("serializes an API failure without exposing its message", () => {
  assert.deepEqual(
    toActionError(new ApiError(401, "sensitive backend detail")),
    {
      ok: false,
      error: { status: 401 },
    },
  );
});

test("normalizes transport failures to service unavailable", () => {
  assert.deepEqual(toActionError(new TypeError("fetch failed")), {
    ok: false,
    error: { status: 503 },
  });
});

test("serializes an optional API error code without exposing its message", () => {
  assert.deepEqual(
    toActionError(
      new ApiError(
        409,
        "Можно создать не более 3 промокодов",
        "affiliate_code_limit",
      ),
    ),
    {
      ok: false,
      error: { code: "affiliate_code_limit", status: 409 },
    },
  );
});
