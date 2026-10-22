import process from "node:process";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/shared/actions/auth/lib/request-flow.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function transport(
  status,
  cookies = ["artmate_access_token=new-session; Max-Age=604800; HttpOnly"],
) {
  const writes = [];
  const requests = [];
  const jar = new Map([
    ["artmate_auth_pending", "bound-pending"],
    ["artmate_auth_browser", "bound-browser"],
    ["artmate_access_token", "existing-session"],
    ["artmate_oauth_yandex_state", "bound-state"],
    ["artmate_oauth_yandex_pkce", "private-verifier"],
  ]);
  const mocks = {
    "next/headers": {
      cookies: async () => ({
        get: (name) => (jar.has(name) ? { value: jar.get(name) } : undefined),
        set: (...args) => writes.push(args),
      }),
      headers: async () => new Headers(),
    },
    "@/shared/lib/api-security": { apiCsrfHeader: { "x-artmate-csrf": "1" } },
    "@/shared/lib/request-evidence-proxy-headers": {
      RequestEvidenceProxyHeaders: { create: () => ({}) },
    },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "fetch", js)(
    (name) => {
      assert.ok(name in mocks, name);
      return mocks[name];
    },
    loaded,
    loaded.exports,
    async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        headers: { getSetCookie: () => cookies },
        json: async () => ({ status }),
      };
    },
  );
  return { client: loaded.exports.AuthFlowTransport, writes, requests };
}

test("pending transport never forwards or accepts a session cookie", async () => {
  const { client, writes, requests } = transport("COMPLETED", [
    "artmate_access_token=injected; Max-Age=604800",
    "artmate_auth_pending=updated; Max-Age=900",
  ]);
  await client.request("/auth/flow/password", "POST", {
    email: "anna@example.com",
    password: "private",
  });
  assert.deepEqual(
    writes.map(([name]) => name),
    ["artmate_auth_pending"],
  );
  assert.equal(
    requests[0].options.headers.cookie,
    "artmate_auth_pending=bound-pending; artmate_auth_browser=bound-browser",
  );
  assert.equal(requests[0].options.cache, "no-store");
});

test("completion accepts a session only after a confirmed completed response", async () => {
  for (const status of ["PENDING", "REJECTED"]) {
    const { client, writes } = transport(status);
    await client.complete({ decisions: [] });
    assert.equal(writes.length, 0);
  }
  const { client, writes, requests } = transport("COMPLETED");
  await client.complete({ decisions: [{ revisionId: "ads", accepted: false }] });
  assert.equal(requests[0].url.endsWith("/auth/flow/complete"), true);
  assert.equal(JSON.parse(requests[0].options.body).decisions[0].accepted, false);
  assert.deepEqual(writes[0], [
    "artmate_access_token",
    "new-session",
    { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 604800 },
  ]);
});

test("bound resume uses completion endpoint and recovers the session after lost response", async () => {
  const { client, writes, requests } = transport("COMPLETED");
  await client.resume();
  assert.equal(requests[0].url.endsWith("/auth/flow/complete"), true);
  assert.equal(requests[0].options.method, "GET");
  assert.equal(requests[0].options.body, undefined);
  assert.equal(requests[0].options.headers.cookie.includes("existing-session"), true);
  assert.equal(writes[0][0], "artmate_access_token");
});

test("session start forwards the current token for verification but cannot install one", async () => {
  const { client, requests, writes } = transport("COMPLETED");
  await client.start();
  assert.equal(requests[0].url.endsWith("/auth/flow/start"), true);
  assert.equal(requests[0].options.method, "POST");
  assert.equal(
    requests[0].options.headers.cookie.includes("artmate_access_token=existing-session"),
    true,
  );
  assert.equal(writes.length, 0);
});

test("OAuth transport forwards only flow and provider cookies, accepts no access token", async () => {
  const { client, writes, requests } = transport("COMPLETED", [
    "artmate_access_token=forged-session; Max-Age=604800",
    "artmate_oauth_yandex_state=opaque-state; Max-Age=600",
    "artmate_oauth_yandex_pkce=private-verifier; Max-Age=600",
    "unrelated_cookie=injected; Max-Age=900",
  ]);
  await client.oauth("/auth/flow/yandex/start", "POST");
  assert.equal(requests[0].options.headers.cookie.includes("existing-session"), false);
  assert.equal(
    requests[0].options.headers.cookie.includes("artmate_oauth_yandex_state=bound-state"),
    true,
  );
  assert.equal(
    requests[0].options.headers.cookie.includes("artmate_oauth_yandex_pkce=private-verifier"),
    true,
  );
  assert.deepEqual(
    writes.map(([name]) => name),
    ["artmate_oauth_yandex_state", "artmate_oauth_yandex_pkce"],
  );
  assert.equal(
    writes.every(([, , options]) => options.httpOnly && options.maxAge === 600),
    true,
  );
});

test("completed sessions use the configured domain while pending cookies stay host-only", async () => {
  const previous = process.env.AUTH_COOKIE_DOMAIN;
  process.env.AUTH_COOKIE_DOMAIN = ".artmate.ru";
  try {
    const { client, writes } = transport("COMPLETED", [
      "artmate_access_token=new-session; Domain=.artmate.ru; Max-Age=604800",
      "artmate_auth_pending=continuation; Max-Age=900",
      "artmate_auth_browser=browser; Max-Age=86400",
    ]);
    await client.complete({ decisions: [] });
    assert.equal(writes.find(([name]) => name === "artmate_access_token")[2].domain, ".artmate.ru");
    for (const [name, , options] of writes)
      if (name !== "artmate_access_token") assert.equal(options.domain, undefined);
  } finally {
    if (previous === undefined) delete process.env.AUTH_COOKIE_DOMAIN;
    else process.env.AUTH_COOKIE_DOMAIN = previous;
  }
});
