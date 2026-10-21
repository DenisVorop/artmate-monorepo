import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { QueryClient } = require("@tanstack/react-query");
const ts = require("typescript");
const sessionKey = ["session", "data"];
const personalizedRoots = [
  ["achievements"],
  ["loyalty"],
  ["orders"],
  ["workshop"],
  ["feature-banners"],
  ["cart-pricing", "welcome-offer"],
  ["email-subscription"],
];
const mocks = {
  "@/entities/email-subscription": {
    emailSubscriptionQuery: { baseKey: personalizedRoots[6] },
  },
  "@/entities/achievement": {
    achievementQuery: { baseKey: personalizedRoots[0] },
  },
  "@/entities/loyalty": { loyaltyQuery: { baseKey: personalizedRoots[1] } },
  "@/entities/orders": { ordersQuery: { baseKey: personalizedRoots[2] } },
  "@/entities/workshop": { workshopQuery: { baseKey: personalizedRoots[3] } },
  "@/entities/session": {
    sessionQuery: {
      baseKey: ["session"],
      getSession: () => ({ queryKey: sessionKey }),
    },
  },
  "@/shared/lib/query-keys": {
    cartPricingQueryKey: ["cart-pricing"],
    featureBannersQueryKey: personalizedRoots[4],
    welcomeOfferQueryKey: personalizedRoots[5],
  },
};
const source = await readFile(
  new URL("../src/features/auth/lib/publish-auth-session.ts", import.meta.url),
  "utf8",
);
const loaded = { exports: {} };
new Function(
  "require",
  "module",
  "exports",
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
)((name) => mocks[name], loaded, loaded.exports);
const { publishAuthSession } = loaded.exports;
const user = {
  id: "new-user",
  provider: "credentials",
  providerUserId: "new-user",
  roles: [],
};
const deferred = () => {
  let resolve;
  const promise = new Promise((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
};

test("session publication removes personalized reads and preserves cart and entered promo", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  const cart = { id: "cart-1", items: [{ id: "product-1", quantity: 2 }] };
  const promo = { code: "MYCODE", status: "editing" };
  client.setQueryData(["cart"], cart);
  client.setQueryData(["promocode", "draft"], promo);
  client.setQueryData(["cart-pricing", "preview"], { total: 100 });
  for (const root of personalizedRoots)
    client.setQueryData([...root, "old-user"], { private: true });
  client.setQueryData(sessionKey, { user: { id: "old-user" } });

  await publishAuthSession(client, user);

  assert.deepEqual(client.getQueryData(sessionKey), { user });
  for (const root of personalizedRoots)
    assert.equal(client.getQueriesData({ queryKey: root }).length, 0);
  assert.deepEqual(client.getQueryData(["cart"]), cart);
  assert.deepEqual(client.getQueryData(["promocode", "draft"]), promo);
  assert.deepEqual(client.getQueryData(["cart-pricing", "preview"]), {
    total: 100,
  });
  assert.equal(
    client.getQueryState(["cart-pricing", "preview"]).isInvalidated,
    true,
  );
  client.clear();
});

test("a stale session response cannot replace the freshly published user", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  const oldResponse = deferred();
  client.setQueryData(sessionKey, { user: { id: "old-user" } });
  const staleRequest = client
    .fetchQuery({ queryKey: sessionKey, queryFn: () => oldResponse.promise })
    .catch(() => undefined);
  await Promise.resolve();
  assert.equal(client.isFetching({ queryKey: sessionKey }), 1);

  await publishAuthSession(client, user);
  oldResponse.resolve({ user: { id: "old-user" } });
  await staleRequest;
  await Promise.resolve();

  assert.deepEqual(client.getQueryData(sessionKey), { user });
  client.clear();
});

test("publication waits for cancellation before any cleanup or fresh identity write", async () => {
  const barrier = deferred();
  const calls = [];
  const client = {
    cancelQueries: ({ queryKey }) => {
      calls.push(["cancel", queryKey]);
      return queryKey[0] === "session" ? barrier.promise : Promise.resolve();
    },
    removeQueries: ({ queryKey }) => calls.push(["remove", queryKey]),
    setQueryData: (queryKey, value) => calls.push(["set", queryKey, value]),
    invalidateQueries: ({ queryKey }) => {
      calls.push(["invalidate", queryKey]);
      return Promise.resolve();
    },
  };
  const publication = publishAuthSession(client, user);
  await Promise.resolve();
  assert.equal(
    calls.some(([kind]) => kind !== "cancel"),
    false,
  );
  barrier.resolve();
  await publication;
  const firstRemove = calls.findIndex(([kind]) => kind === "remove");
  const published = calls.findIndex(([kind]) => kind === "set");
  assert.equal(firstRemove, personalizedRoots.length + 1);
  assert.equal(published, firstRemove + personalizedRoots.length);
  assert.deepEqual(calls[published], ["set", sessionKey, { user }]);
  assert.deepEqual(calls.at(-1), ["invalidate", ["cart-pricing"]]);
});
