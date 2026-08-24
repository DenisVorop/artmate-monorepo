import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, mocks) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const testModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) {
      return mocks[specifier];
    }

    throw new Error(`Unexpected test module import: ${specifier}`);
  };

  new Function("require", "module", "exports", output)(
    localRequire,
    testModule,
    testModule.exports,
  );

  return testModule.exports;
}

test("orders proxy forwards only sanitized client IP headers and required cookies", async () => {
  const apiSecurity = evaluateTypeScript(
    await readSource("src/shared/lib/api-security.ts"),
    {},
  );
  const requestHeaders = new Headers({
    authorization: "Bearer untrusted",
    cookie: "untrusted_cookie=1",
    "x-forwarded-for": "203.0.113.10, 10.0.0.2",
    "x-real-ip": "198.51.100.20",
    "x-untrusted-header": "must-not-be-forwarded",
  });
  const cookieValues = new Map([
    ["artmate_access_token", "token/value"],
    ["cart_id", "cart 1"],
  ]);
  let sanitizerInput;
  const ApiResult = {
    prepareApi: (callback) => async () => {
      try {
        const data = await callback();

        return { toDTO: () => ({ data }) };
      } catch (error) {
        return { toDTO: () => ({ error }) };
      }
    },
  };
  const actions = evaluateTypeScript(
    await readSource("src/shared/actions/orders/orders.actions.ts"),
    {
      "@/shared/lib/api-result": { ApiResult },
      "@/shared/lib/api-security": {
        apiCsrfHeader: apiSecurity.apiCsrfHeader,
        getForwardedIpHeaders: (headerStore) => {
          sanitizerInput = headerStore;

          return apiSecurity.getForwardedIpHeaders(headerStore);
        },
      },
      "next/headers": {
        cookies: async () => ({
          get: (name) => {
            const value = cookieValues.get(name);

            return value ? { value } : undefined;
          },
        }),
        headers: async () => requestHeaders,
      },
    },
  );
  const originalFetch = globalThis.fetch;
  let requestInit;

  globalThis.fetch = async (_url, init) => {
    requestInit = init;

    return {
      json: async () => ({}),
      ok: true,
    };
  };

  try {
    const result = await actions.calculateCheckout({
      delivery: { pickupPointId: "ozon-1", provider: "ozon" },
    });

    assert.deepEqual(result, { data: {} });
    assert.strictEqual(sanitizerInput, requestHeaders);
    assert.deepEqual(requestInit.headers, {
      "content-type": "application/json",
      cookie:
        "cart_id=cart%201; artmate_access_token=token%2Fvalue",
      "x-artmate-csrf": "1",
      "x-forwarded-for": "203.0.113.10",
      "x-real-ip": "198.51.100.20",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
