import assert from "node:assert/strict";
import test from "node:test";

import { parseAuthCookie } from "../src/shared/lib/auth-cookie.ts";

test("parses access token attributes from a combined set-cookie header", () => {
  const cookie = parseAuthCookie(
    "other=value; Path=/, artmate_access_token=secret%20token; Max-Age=3600; Domain=.artmate.ru; HttpOnly",
  );

  assert.deepEqual(cookie, {
    domain: ".artmate.ru",
    maxAge: 3600,
    value: "secret%20token",
  });
});

test("ignores unrelated and malformed cookie headers", () => {
  assert.equal(parseAuthCookie(null), undefined);
  assert.equal(parseAuthCookie("other=value; Path=/"), undefined);
});
