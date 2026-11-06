import process from "node:process";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { QueryClient } = require("@tanstack/react-query");
const csrf = { "x-artmate-csrf": "1" };
const sessionKey = ["session", "data"];
async function load(path, mocks) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const loaded = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  )((id) => (id in mocks ? mocks[id] : require(id)), loaded, loaded.exports);
  return loaded.exports;
}

const { AuthLogoutResponse } = await load("shared/lib/auth-logout-response.ts", {
  "./api-security": { apiCsrfHeader: csrf },
});

test("production logout expires both deployed cookie scopes without Next collapsing same-name headers", () => {
  const previous = { domain: process.env.AUTH_COOKIE_DOMAIN, node: process.env.NODE_ENV };
  process.env.AUTH_COOKIE_DOMAIN = ".artmate.ru";
  process.env.NODE_ENV = "production";
  try {
    const response = AuthLogoutResponse.create(
      new Request("https://artmate.ru/auth/logout", {
        method: "POST",
        headers: csrf,
      }),
    );
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const cookies = response.headers.getSetCookie();
    assert.equal(cookies.length, 10);
    for (const name of [
      "artmate_access_token",
      "artmate_auth_pending",
      "artmate_auth_browser",
      "artmate_oauth_yandex_state",
      "artmate_oauth_yandex_pkce",
    ]) {
      const matches = cookies.filter((value) => value.startsWith(`${name}=`));
      assert.equal(matches.length, 2, name);
      assert.equal(matches.filter((value) => /Domain=\.artmate\.ru/i.test(value)).length, 1, name);
      assert.equal(matches.filter((value) => !/Domain=/i.test(value)).length, 1, name);
      for (const value of matches) {
        assert.match(value, /Max-Age=0/i);
        assert.match(value, /Path=\//i);
        assert.match(value, /HttpOnly/i);
        assert.match(value, /Secure/i);
        assert.match(value, /SameSite=lax/i);
      }
    }
  } finally {
    for (const [key, value] of Object.entries({
      AUTH_COOKIE_DOMAIN: previous.domain,
      NODE_ENV: previous.node,
    }))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});

test("logout rejects ordinary cross-site form submissions and supports host-only development cookies", () => {
  assert.equal(
    AuthLogoutResponse.create(new Request("https://artmate.ru/auth/logout", { method: "POST" }))
      .status,
    403,
  );
  const previous = process.env.AUTH_COOKIE_DOMAIN;
  delete process.env.AUTH_COOKIE_DOMAIN;
  try {
    const response = AuthLogoutResponse.create(
      new Request("http://localhost:3000/auth/logout", { method: "POST", headers: csrf }),
    );
    assert.equal(response.status, 204);
    assert.equal(response.headers.getSetCookie().length, 5);
  } finally {
    if (previous !== undefined) process.env.AUTH_COOKIE_DOMAIN = previous;
  }
});

test("logout drains authentication and cancels a stale session response before publishing anonymous state", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let resolveSession;
  const stale = client
    .fetchQuery({
      queryKey: sessionKey,
      queryFn: () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    })
    .catch(() => undefined);
  client.setQueryData(["cart"], { id: "preserved-cart" });
  client.setQueryData(["orders", "old-user"], { private: true });
  const events = [];
  let finishAuthCancellation;
  let options;
  const { useLogoutMutation } = await load("features/auth/model/use-logout.ts", {
    react: {
      useContext: () => ({
        cancel: () =>
          new Promise((resolve) => {
            events.push("auth-draining");
            finishAuthCancellation = resolve;
          }),
      }),
    },
    "../lib/auth-provider/auth.context": { AuthContext: {} },
    "@tanstack/react-query": {
      useQueryClient: () => client,
      useMutation: (value) => {
        options = value;
        return {};
      },
    },
    "@/entities/email-subscription": {
      emailSubscriptionQuery: { baseKey: ["email-subscription"] },
    },
    "@/entities/achievement": { achievementQuery: { baseKey: ["achievements"] } },
    "@/entities/session": {
      sessionQuery: { baseKey: ["session"], getSession: () => ({ queryKey: sessionKey }) },
    },
    "@/entities/loyalty": { loyaltyQuery: { baseKey: ["loyalty"] } },
    "@/entities/orders": { ordersQuery: { baseKey: ["orders"] } },
    "@/entities/workshop": { workshopQuery: { baseKey: ["workshop"] } },
    "@/shared/actions/auth": {
      logout: async () => {
        events.push("cookies-cleared");
        return {};
      },
    },
    "@/shared/lib/api-result": { ApiResult: { fromDTO: () => ({ unwrap: () => ({ ok: true }) }) } },
    "@/shared/lib/query-keys": {
      cartPricingQueryKey: ["cart-pricing"],
      featureBannersQueryKey: ["feature-banners"],
      welcomeOfferQueryKey: ["cart-pricing", "welcome-offer"],
      likesQueryKey: ["likes"],
    },
  });
  try {
    useLogoutMutation({ onSuccess: () => events.push("navigate-home") });
    const mutation = options.mutationFn();
    assert.deepEqual(events, ["auth-draining"]);
    finishAuthCancellation();
    await mutation;
    await options.onSuccess();
    resolveSession({ user: { id: "old-user" } });
    await stale;
    assert.deepEqual(client.getQueryData(sessionKey), { user: null });
    assert.equal(client.getQueryData(["orders", "old-user"]), undefined);
    assert.deepEqual(client.getQueryData(["cart"]), { id: "preserved-cart" });
    assert.deepEqual(events, ["auth-draining", "cookies-cleared", "navigate-home"]);
  } finally {
    client.clear();
  }
});
