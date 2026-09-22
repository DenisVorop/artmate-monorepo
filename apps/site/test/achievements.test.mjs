import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = (path) => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");

async function load(path, mocks = {}) {
  const code = ts.transpileModule(await source(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

test("achievement responses are user-scoped and cancelled responses cannot restore private data", async () => {
  const calls = [];
  const schemas = await load("entities/achievement/model/types.ts");
  const { achievementQuery } = await load("entities/achievement/model/query.ts", {
    "./types": schemas,
    "@/shared/actions/achievements": {
      getMyAchievements: async (userId) => {
        calls.push(userId);
        return { achievements: [] };
      },
    },
    "@/shared/lib/api-result": { ApiResult: { fromDTO: (value) => ({ unwrap: () => value }) } },
  });
  assert.notDeepEqual(
    achievementQuery.list("alice").queryKey,
    achievementQuery.list("bob").queryKey,
  );
  assert.deepEqual(
    await achievementQuery.list("alice").queryFn({ signal: new AbortController().signal }),
    { achievements: [] },
  );
  assert.deepEqual(calls, ["alice"]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(achievementQuery.list("alice").queryFn({ signal: controller.signal }), {
    name: "AbortError",
  });
});

test("SSR loads achievements regardless of membership, history or loyalty errors", async () => {
  const { QueryClient } = require("@tanstack/react-query");
  for (const overview of [
    { enrolled: false, member: null },
    { enrolled: true, member: { status: "blocked", historyState: "ready" } },
    { enrolled: true, member: { status: "active", historyState: "pending" } },
    { enrolled: true, member: { status: "active", historyState: "failed" } },
    new Error("Loyalty unavailable"),
  ]) {
    for (const mode of ["overview", "achievements"]) {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const calls = [];
      const query = (domain, data) => (userId) => ({
        queryKey: [domain, userId],
        queryFn: async () => {
          calls.push(domain);
          if (data instanceof Error) throw data;
          return data;
        },
      });
      const { AccountDataBuilder } = await load("_app/lib/account-data-builder.ts", {
        "@/entities/achievement": {
          achievementQuery: { list: query("achievements", { achievements: [] }) },
        },
        "@/entities/loyalty": {
          loyaltyQuery: { overview: query("loyalty", overview), dashboard: query("tier", {}) },
        },
        "@/entities/orders": { ordersQuery: { getMyOrders: query("orders", []) } },
        "@/entities/workshop": { workshopQuery: { preview: query("workshop", {}) } },
        "@/shared/lib/query-client": { getQueryClient: () => client },
      });
      await new AccountDataBuilder().build("alice", mode);
      assert.deepEqual(client.getQueryData(["achievements", "alice"]), { achievements: [] });
      assert.equal(calls.includes("tier"), false);
      if (mode === "achievements") assert.deepEqual(calls, ["achievements"]);
      client.clear();
    }
  }
});

test("gallery and achievement entity have no loyalty membership dependency or credit assertion", async () => {
  const gallery = await source("features/achievements/ui/achievement-gallery.tsx");
  assert.match(gallery, /useAchievementsData\(userId\)/);
  assert.doesNotMatch(gallery, /loyalty|Loyalty|historyState|enrolled|member|Вступите/);
  const card = await source("entities/achievement/ui/achievement-card.tsx");
  assert.match(card, /Награда в клубе:/);
  assert.doesNotMatch(card, /entities\/loyalty|formatLoyalty|Начислено|\+\{/);
  const { loyaltyDashboardSchema } = await load("entities/loyalty/model/types.ts");
  assert.deepEqual(loyaltyDashboardSchema.parse({ tier: null }), { tier: null });
});

test("achievement transport checks account ownership before fetching and uses its own endpoint", async () => {
  const previousFetch = globalThis.fetch;
  let owner = "bob";
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return { ok: true, json: async () => ({ achievements: [] }) };
  };
  try {
    const actions = await load("shared/actions/achievements/achievements.actions.ts", {
      "next/headers": {
        cookies: async () => ({ get: () => ({ value: "private-token" }) }),
        headers: async () => ({}),
      },
      "@/shared/actions/auth": { getAuthSession: async () => ({ data: { user: { id: owner } } }) },
      "@/shared/lib/api-security": { getForwardedIpHeaders: () => ({}) },
      "@/shared/lib/api-result": {
        ApiResult: {
          fromDTO: (value) => value,
          prepareApi: (fn) => async () => {
            try {
              const data = await fn();
              return { toDTO: () => ({ data }) };
            } catch (error) {
              return { toDTO: () => ({ error: { status: error.status, stack: "private-stack" } }) };
            }
          },
        },
      },
    });
    assert.deepEqual(await actions.getMyAchievements("alice"), { error: { status: 401 } });
    assert.equal(requests.length, 0);
    owner = "alice";
    assert.deepEqual(await actions.getMyAchievements("alice"), { data: { achievements: [] } });
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /\/achievements\/me$/);
    assert.equal(requests[0].init.cache, "no-store");
    assert.equal(requests[0].init.headers.cookie, "artmate_access_token=private-token");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
