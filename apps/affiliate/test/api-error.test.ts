import assert from "node:assert/strict";
import test from "node:test";

import { getApiErrorDetails } from "../src/shared/lib/api-error.ts";

test("parses the API error message and optional string code", async () => {
  const response = new Response(
    JSON.stringify({
      code: "affiliate_code_limit",
      message: "Можно создать не более 3 промокодов",
    }),
    { status: 409 },
  );

  assert.deepEqual(await getApiErrorDetails(response), {
    code: "affiliate_code_limit",
    message: "Можно создать не более 3 промокодов",
  });
});

test("ignores a non-string API error code", async () => {
  const response = new Response(
    JSON.stringify({ code: { unsafe: true }, message: "Bad request" }),
    { status: 400 },
  );

  assert.deepEqual(await getApiErrorDetails(response), {
    code: undefined,
    message: "Bad request",
  });
});
