import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

test("session reads skip the API for guests and forward the cookie for signed-in visitors", async (t) => {
  const source = await readFile(
    new URL("../src/shared/actions/auth/auth.actions.ts", import.meta.url),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const user = { id: "customer-1" };
  const request = t.mock.method(globalThis, "fetch", async () => Response.json({ user }));
  let accessToken;
  const mocks = {
    "next/headers": {
      cookies: async () => ({
        get: (name) => (name === "artmate_access_token" && accessToken ? { value: accessToken } : undefined),
      }),
      headers: async () => new Headers(),
    },
    "@/shared/lib/api-result": {
      ApiResult: {
        prepareApi: (read) => async () => {
          const data = await read();
          return { toDTO: () => ({ data }) };
        },
      },
    },
    "@/shared/lib/api-security": { apiCsrfHeader: {}, getForwardedIpHeaders: () => ({}) },
  };
  const actions = {};
  new Function("require", "exports", js)((id) => mocks[id], actions);

  assert.deepEqual((await actions.getAuthSession()).data, { user: null });
  assert.equal(request.mock.callCount(), 0);

  accessToken = "fixture/token";
  assert.deepEqual((await actions.getAuthSession()).data, { user });
  assert.equal(request.mock.callCount(), 1);
  const [url, options] = request.mock.calls[0].arguments;
  assert.match(url, /\/auth\/session$/);
  assert.equal(options.headers.cookie, "artmate_access_token=fixture%2Ftoken");
});
