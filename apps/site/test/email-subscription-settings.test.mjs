import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { setImmediate } from "node:timers";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const {
  QueryClient,
  MutationObserver,
  QueryObserver,
  queryOptions,
} = require("@tanstack/react-query");
const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
function evaluate(source, mocks = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const turn = () => new Promise((resolve) => setImmediate(resolve));
const sessionKey = ["session", "data"];
const dto = { email: "owner@example.com", subscribed: true, version: 1, stateRevision: 1 };
const result = (data) => ({
  status: "success",
  data,
  isSuccess: true,
  isError: false,
  isEmpty: false,
});
const apiResult = {
  fromDTO: (value) => ({
    data: value.data,
    unwrap: () => {
      if (value.error) throw new Error(value.error.message);
      return value.data;
    },
  }),
  prepareApi: (call) => async () => {
    try {
      const data = await call();
      return { toDTO: () => result(data) };
    } catch (error) {
      return {
        toDTO: () => ({
          error: { message: error.message, status: error.status },
          isError: true,
        }),
      };
    }
  },
};
async function loadReadModel(getStatus = async () => result(dto)) {
  const types = evaluate(await read("entities/email-subscription/model/types.ts"));
  const query = evaluate(await read("entities/email-subscription/model/query.ts"), {
    "@tanstack/react-query": { queryOptions },
    "@/shared/actions/consents": { getEmailSubscription: getStatus },
    "@/shared/lib/api-result": { ApiResult: apiResult },
    "./types": types,
  });
  return { ...types, ...query };
}
async function loadMutation(
  client,
  action,
  entity,
  { filename = "use-revoke-subscription.ts", actionName = "revokeEmailSubscription" } = {},
) {
  let options;
  const loadedModule = evaluate(
    await read(`features/email-subscription-settings/model/${filename}`),
    {
      "@tanstack/react-query": {
        useQueryClient: () => client,
        useMutation: (value) => {
          options = value;
          return {};
        },
      },
      "@/entities/email-subscription": entity,
      "@/entities/session": {
        sessionQuery: { getSession: () => ({ queryKey: sessionKey }) },
      },
      "@/shared/actions/consents": { [actionName]: action },
      "@/shared/lib/api-result": { ApiResult: apiResult },
    },
  );
  const hook = filename.startsWith("use-grant-")
    ? loadedModule.useGrantSubscription
    : loadedModule.useRevokeSubscription;
  hook();
  return new MutationObserver(client, options);
}

test("subscription read is owner-keyed, fresh on focus/mount and never sends an actor in the API body", async () => {
  const requests = [];
  const { emailSubscriptionQuery } = await loadReadModel(async (ownerId) => {
    requests.push(ownerId);
    return result(dto);
  });
  const a = emailSubscriptionQuery.status("A"),
    b = emailSubscriptionQuery.status("B");
  assert.notDeepEqual(a.queryKey, b.queryKey);
  assert.equal(a.staleTime, 0);
  assert.equal(a.refetchOnWindowFocus, true);
  assert.equal(a.refetchOnMount, true);
  assert.equal(a.retry, false);
  assert.deepEqual(await a.queryFn({ signal: new AbortController().signal }), dto);
  assert.deepEqual(requests, ["A"]);
});

test("a cancelled late read never publishes its active state", async () => {
  const pending = deferred();
  const { emailSubscriptionQuery } = await loadReadModel(() => pending.promise);
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  const query = emailSubscriptionQuery.status("A");
  const request = client.fetchQuery(query).catch(() => undefined);
  await turn();
  await client.cancelQueries({ queryKey: query.queryKey });
  pending.resolve(result(dto));
  await request;
  await turn();
  assert.equal(client.getQueryData(query.queryKey), undefined);
  client.clear();
});

test("changing read owner never carries the previous account status into the new observer", async () => {
  const pendingB = deferred();
  const { emailSubscriptionQuery } = await loadReadModel((owner) =>
    owner === "A" ? Promise.resolve(result(dto)) : pendingB.promise,
  );
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  await client.fetchQuery(emailSubscriptionQuery.status("A"));
  const observer = new QueryObserver(client, emailSubscriptionQuery.status("A"));
  const unsubscribe = observer.subscribe(() => undefined);
  observer.setOptions(emailSubscriptionQuery.status("B"));
  assert.equal(observer.getCurrentResult().data, undefined);
  pendingB.resolve(result({ ...dto, email: "b@example.com", subscribed: false }));
  await turn();
  assert.equal(observer.getCurrentResult().data.email, "b@example.com");
  unsubscribe();
  client.clear();
});

test("read hook hides stale permission on errors and while disabled", async () => {
  const entity = await loadReadModel();
  let state = {
      data: dto,
      isPending: false,
      isFetching: false,
      isError: true,
      refetch() {},
    },
    options;
  const mod = evaluate(
    await read("entities/email-subscription/model/use-email-subscription-data.ts"),
    {
      "@tanstack/react-query": {
        useQuery: (value) => {
          options = value;
          return state;
        },
      },
      "./query": entity,
    },
  );
  assert.equal(mod.useEmailSubscriptionData("A", true).data, undefined);
  state = { ...state, isError: false };
  assert.equal(mod.useEmailSubscriptionData("A", false).data, undefined);
  assert.equal(options.enabled, false);
  assert.deepEqual(mod.useEmailSubscriptionData("A", true).data, dto);
});

test("revoke cancels pre-existing reads and publishes only the acknowledged revoked version", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  const late = deferred();
  const entity = await loadReadModel(() => late.promise);
  const key = entity.emailSubscriptionQuery.status("A").queryKey;
  client.setQueryData(sessionKey, { user: { id: "A" } });
  client.setQueryData(key, dto);
  const stale = client.fetchQuery(entity.emailSubscriptionQuery.status("A")).catch(() => undefined);
  await turn();
  const revoked = { ...dto, subscribed: false, version: 2 };
  const mutation = await loadMutation(client, async () => result(revoked), entity);
  await mutation.mutate("A");
  late.resolve(result(dto));
  await stale;
  await turn();
  assert.deepEqual(client.getQueryData(key), revoked);
  client.clear();
});

test("revoke response from a previous account cannot recreate its cache after session switch", async () => {
  const client = new QueryClient();
  const entity = await loadReadModel();
  const pending = deferred();
  client.setQueryData(sessionKey, { user: { id: "A" } });
  const mutation = await loadMutation(client, () => pending.promise, entity);
  const request = mutation.mutate("A");
  await turn();
  client.removeQueries({ queryKey: entity.emailSubscriptionQuery.baseKey });
  client.setQueryData(sessionKey, { user: { id: "B" } });
  pending.resolve(result({ ...dto, subscribed: false, version: 2 }));
  await request;
  assert.equal(client.getQueryData(entity.emailSubscriptionQuery.status("A").queryKey), undefined);
  assert.equal(client.getQueryData(entity.emailSubscriptionQuery.status("B").queryKey), undefined);
  client.clear();
});

test("revoke rejects absent acknowledgement and never overwrites a newer permission version", async () => {
  const client = new QueryClient();
  const entity = await loadReadModel();
  client.setQueryData(sessionKey, { user: { id: "A" } });
  const key = entity.emailSubscriptionQuery.status("A").queryKey;
  client.setQueryData(key, { ...dto, version: 5 });
  for (const value of [undefined, dto, { ...dto, subscribed: "false" }]) {
    const mutation = await loadMutation(client, async () => result(value), entity);
    await assert.rejects(mutation.mutate("A"));
    assert.equal(client.getQueryData(key).version, 5);
  }
  const mutation = await loadMutation(
    client,
    async () => result({ ...dto, subscribed: false, version: 2 }),
    entity,
  );
  await mutation.mutate("A");
  assert.equal(client.getQueryData(key).version, 5);
  client.clear();
});

test("grant cancels stale reads and publishes only an acknowledged active version for its owner", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  const late = deferred();
  const entity = await loadReadModel(() => late.promise);
  const key = entity.emailSubscriptionQuery.status("A").queryKey;
  client.setQueryData(sessionKey, { user: { id: "A" } });
  client.setQueryData(key, { ...dto, subscribed: false });
  const stale = client.fetchQuery(entity.emailSubscriptionQuery.status("A")).catch(() => undefined);
  await turn();
  const active = {
    ...dto,
    subscribed: true,
    version: 2,
    stateRevision: 2,
    grantRevisionId: "ads-r2",
  };
  const calls = [];
  const mutation = await loadMutation(
    client,
    async (...args) => {
      calls.push(args);
      return result(active);
    },
    entity,
    {
      filename: "use-grant-subscription.ts",
      actionName: "grantEmailSubscription",
    },
  );
  await mutation.mutate({
    ownerId: "A",
    revisionId: "ads-r2",
    expectedVersion: 1,
    expectedStateRevision: 1,
  });
  late.resolve(result({ ...dto, subscribed: false }));
  await stale;
  await turn();
  assert.deepEqual(calls, [
    ["A", { revisionId: "ads-r2", expectedVersion: 1, expectedStateRevision: 1 }],
  ]);
  assert.deepEqual(client.getQueryData(key), active);
  client.clear();
});

test("grant response from a previous account cannot recreate its cache after a session switch", async () => {
  const client = new QueryClient();
  const entity = await loadReadModel();
  const pending = deferred();
  client.setQueryData(sessionKey, { user: { id: "A" } });
  const mutation = await loadMutation(client, () => pending.promise, entity, {
    filename: "use-grant-subscription.ts",
    actionName: "grantEmailSubscription",
  });
  const request = mutation.mutate({
    ownerId: "A",
    revisionId: "ads-r2",
    expectedVersion: 1,
    expectedStateRevision: 1,
  });
  await turn();
  client.removeQueries({ queryKey: entity.emailSubscriptionQuery.baseKey });
  client.setQueryData(sessionKey, { user: { id: "B" } });
  pending.resolve(result({ ...dto, subscribed: true, version: 2 }));
  await request;
  assert.equal(client.getQueryData(entity.emailSubscriptionQuery.status("A").queryKey), undefined);
  assert.equal(client.getQueryData(entity.emailSubscriptionQuery.status("B").queryKey), undefined);
  client.clear();
});

test("grant rejects missing acknowledgement and never overwrites a newer permission version", async () => {
  const client = new QueryClient();
  const entity = await loadReadModel();
  client.setQueryData(sessionKey, { user: { id: "A" } });
  const key = entity.emailSubscriptionQuery.status("A").queryKey;
  client.setQueryData(key, { ...dto, subscribed: false, version: 5 });
  for (const value of [undefined, { ...dto, subscribed: false }, { ...dto, subscribed: "true" }]) {
    const mutation = await loadMutation(client, async () => result(value), entity, {
      filename: "use-grant-subscription.ts",
      actionName: "grantEmailSubscription",
    });
    await assert.rejects(
      mutation.mutate({
        ownerId: "A",
        revisionId: "ads-r2",
        expectedVersion: 5,
        expectedStateRevision: 5,
      }),
    );
    assert.equal(client.getQueryData(key).version, 5);
  }
  const mutation = await loadMutation(
    client,
    async () => result({ ...dto, subscribed: true, version: 2 }),
    entity,
    {
      filename: "use-grant-subscription.ts",
      actionName: "grantEmailSubscription",
    },
  );
  await mutation.mutate({
    ownerId: "A",
    revisionId: "ads-r2",
    expectedVersion: 5,
    expectedStateRevision: 5,
  });
  assert.equal(client.getQueryData(key).version, 5);
  client.clear();
});

test("grant response cannot overwrite a newer off-state fence at the same subscription version", async () => {
  const client = new QueryClient();
  const entity = await loadReadModel();
  client.setQueryData(sessionKey, { user: { id: "A" } });
  const key = entity.emailSubscriptionQuery.status("A").queryKey;
  const newerOffState = { ...dto, subscribed: false, version: 5, stateRevision: 12 };
  client.setQueryData(key, newerOffState);
  const mutation = await loadMutation(
    client,
    async () => result({ ...dto, subscribed: true, version: 5, stateRevision: 11 }),
    entity,
    {
      filename: "use-grant-subscription.ts",
      actionName: "grantEmailSubscription",
    },
  );
  await mutation.mutate({
    ownerId: "A",
    revisionId: "ads-r2",
    expectedVersion: 5,
    expectedStateRevision: 11,
  });
  assert.deepEqual(client.getQueryData(key), newerOffState);
  client.clear();
});

async function loadTransport(owner = "A") {
  let cookieReads = 0,
    sessionReads = 0;
  const evidenceOptions = [];
  const loadedModule = evaluate(await read("shared/actions/consents/consents.actions.ts"), {
    "next/headers": {
      cookies: async () => {
        cookieReads++;
        return { get: () => ({ value: "access/= secret" }) };
      },
      headers: async () => new Headers({ "x-real-ip": "127.0.0.77" }),
    },
    "@/shared/actions/auth": {
      getAuthSession: async () => {
        sessionReads++;
        return result({ user: { id: owner } });
      },
    },
    "@/shared/lib/api-security": {
      apiCsrfHeader: { "x-artmate-csrf": "1" },
      getForwardedIpHeaders: (headers) => ({
        "x-real-ip": headers.get("x-real-ip"),
      }),
    },
    "@/shared/lib/api-result": { ApiResult: apiResult },
    "@/shared/lib/request-evidence-proxy-headers": {
      RequestEvidenceProxyHeaders: {
        create: (_headers, _method, _path, _body, options) => {
          evidenceOptions.push(options);
          return { "x-artmate-auth-context": "sanitized-context" };
        },
      },
    },
  });
  return {
    ...loadedModule,
    get cookieReads() {
      return cookieReads;
    },
    get sessionReads() {
      return sessionReads;
    },
    evidenceOptions,
  };
}

test("authenticated transport sends the requested revision/version with mandatory grant evidence", async () => {
  const oldFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => dto };
  };
  try {
    const action = await loadTransport();
    const read = await action.getEmailSubscription("A"),
      grant = await action.grantEmailSubscription("A", {
        revisionId: "advertising-r4",
        expectedVersion: 7,
        expectedStateRevision: 11,
      }),
      revoke = await action.revokeEmailSubscription("A");
    assert.deepEqual(read.data, dto);
    assert.deepEqual(grant.data, dto);
    assert.deepEqual(revoke.data, dto);
    assert.equal(calls[0].init.method, "GET");
    assert.equal(calls[1].url.endsWith("/grant"), true);
    assert.equal(calls[1].init.method, "POST");
    assert.deepEqual(JSON.parse(calls[1].init.body), {
      revisionId: "advertising-r4",
      expectedVersion: 7,
      expectedStateRevision: 11,
    });
    assert.equal(calls[2].init.method, "POST");
    assert.equal(calls[2].init.body, "{}");
    assert.deepEqual(action.evidenceOptions, [{ required: true }, { required: false }]);
    for (const { init } of calls) {
      assert.equal(init.headers.cookie, "artmate_access_token=access%2F%3D%20secret");
      assert.equal(init.headers["x-artmate-csrf"], "1");
      assert.equal(init.headers["x-real-ip"], "127.0.0.77");
      assert.equal(init.cache, "no-store");
    }
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("a wrong cache owner cannot read or revoke another session through the proxy", async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("must not fetch");
  };
  try {
    const action = await loadTransport("B");
    assert.equal((await action.getEmailSubscription("A")).error.status, 401);
    assert.equal(
      (
        await action.grantEmailSubscription("A", {
          revisionId: "advertising-r4",
          expectedVersion: 1,
          expectedStateRevision: 1,
        })
      ).error.status,
      401,
    );
    assert.equal((await action.revokeEmailSubscription("A")).error.status, 401);
    assert.equal(calls, 0);
    assert.equal(action.cookieReads, 0);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("public unsubscribe sends only capability JSON and CSRF, never the browser session", async () => {
  const oldFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ unsubscribed: true }) };
  };
  try {
    const action = await loadTransport();
    assert.deepEqual((await action.unsubscribeEmail({ token: "revoke-only-token" })).data, {
      unsubscribed: true,
    });
    assert.equal(action.cookieReads, 0);
    assert.equal(action.sessionReads, 0);
    assert.equal(calls[0].init.headers.cookie, undefined);
    assert.equal(calls[0].init.headers["x-artmate-csrf"], "1");
    assert.equal(calls[0].init.headers["x-artmate-auth-context"], "sanitized-context");
    assert.equal(calls[0].init.cache, "no-store");
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      token: "revoke-only-token",
    });
    assert.ok(calls[0].url.endsWith("/unsubscribe/confirm"));
    assert.equal(calls[0].url.includes("revoke-only-token"), false);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

async function stateHarness() {
  const entity = await loadReadModel();
  const states = [],
    refs = [],
    effects = [],
    grants = [],
    revokes = [];
  let stateIndex = 0,
    refIndex = 0,
    effectIndex = 0;
  let user = { id: "A", email: dto.email };
  let status = { ...dto, subscribed: false, grantRevisionId: "advertising-r1" };
  let grantError,
    revokeError,
    grantPending = false,
    revokePending = false;
  const grantBarrier = deferred(),
    revokeBarrier = deferred();
  let waitGrant = false,
    waitRevoke = false;
  const hook = evaluate(
    await read("features/email-subscription-settings/lib/use-settings-state.ts"),
    {
      react: {
        useState: (initial) => {
          const i = stateIndex++;
          if (!(i in states)) states[i] = initial;
          return [
            states[i],
            (value) => {
              states[i] = value;
            },
          ];
        },
        useRef: (initial) => (refs[refIndex++] ??= { current: initial }),
        useEffect: (callback) => {
          const i = effectIndex++;
          if (!(i in effects)) effects[i] = callback();
        },
      },
      "@/entities/email-subscription": {
        ...entity,
        useEmailSubscriptionData: () => ({
          data: status,
          isPending: false,
          isFetching: false,
          isError: false,
        }),
      },
      "@/entities/session": { useSession: () => ({ user, isPending: false }) },
      "../model/use-grant-subscription": {
        useGrantSubscription: () => ({
          isPending: grantPending,
          grant: async (input) => {
            grants.push(input);
            grantPending = true;
            try {
              if (waitGrant) await grantBarrier.promise;
              if (grantError) throw grantError;
              status = { ...status, subscribed: true, version: status.version + 1 };
              return status;
            } finally {
              grantPending = false;
            }
          },
        }),
      },
      "../model/use-revoke-subscription": {
        useRevokeSubscription: () => ({
          isPending: revokePending,
          revoke: async (ownerId) => {
            revokes.push(ownerId);
            revokePending = true;
            try {
              if (waitRevoke) await revokeBarrier.promise;
              if (revokeError) throw revokeError;
              status = { ...status, subscribed: false, version: status.version + 1 };
              return status;
            } finally {
              revokePending = false;
            }
          },
        }),
      },
    },
  );
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    effectIndex = 0;
    return hook.useSettingsState();
  };
  return {
    render,
    grants,
    revokes,
    setStatus: (value) => {
      status = value;
    },
    setUser: (value) => {
      user = value;
    },
    setGrantError: (value) => {
      grantError = value;
    },
    setRevokeError: (value) => {
      revokeError = value;
    },
    delayGrant: () => {
      waitGrant = true;
    },
    finishGrant: () => grantBarrier.resolve(),
    delayRevoke: () => {
      waitRevoke = true;
    },
    finishRevoke: () => revokeBarrier.resolve(),
    unmount: () => effects.forEach((cleanup) => cleanup?.()),
  };
}

test("settings enables ads directly with the published revision and expected version", async () => {
  const h = await stateHarness();
  await h.render().subscribe();
  assert.deepEqual(h.grants, [
    { ownerId: "A", revisionId: "advertising-r1", expectedVersion: 1, expectedStateRevision: 1 },
  ]);
  assert.equal(h.render().feedback.success, "Подписка включена.");
});

test("settings cannot grant without a published advertising revision", async () => {
  const h = await stateHarness();
  h.setStatus({ ...dto, subscribed: false, grantRevisionId: undefined });
  await h.render().subscribe();
  assert.equal(h.grants.length, 0);
  assert.equal(h.render().feedback.success, undefined);
  assert.equal(
    h.render().feedback.error,
    "Не удалось включить подписку. Обновите страницу и попробуйте ещё раз.",
  );
});

test("settings shows success only after an acknowledged active permission", async () => {
  const h = await stateHarness();
  h.setGrantError(new Error("private-token"));
  await h.render().subscribe();
  assert.equal(h.render().feedback.success, undefined);
  assert.equal(
    h.render().feedback.error,
    "Не удалось включить подписку. Обновите страницу и попробуйте ещё раз.",
  );
});

test("settings prevents duplicate grant and revoke while a request is pending", async () => {
  const h = await stateHarness();
  h.delayGrant();
  const granting = h.render().subscribe();
  await h.render().subscribe();
  await h.render().revoke();
  assert.equal(h.grants.length, 1);
  assert.equal(h.revokes.length, 0);
  h.finishGrant();
  await granting;
  assert.equal(h.render().feedback.success, "Подписка включена.");
  h.delayRevoke();
  const revoking = h.render().revoke();
  await h.render().revoke();
  await h.render().subscribe();
  assert.equal(h.revokes.length, 1);
  assert.equal(h.grants.length, 1);
  h.finishRevoke();
  await revoking;
  assert.equal(h.render().feedback.success, "Вы отписались от рекламных писем.");
});

test("settings revoke remains independent and errors do not claim unsubscribe", async () => {
  const h = await stateHarness();
  h.setRevokeError(new Error("private-token"));
  await h.render().revoke();
  assert.equal(h.grants.length, 0);
  assert.equal(h.render().feedback.success, undefined);
  assert.equal(h.render().feedback.error, "Не удалось отписаться. Попробуйте ещё раз.");
});

test("settings hides prior identity feedback and ignores late revoke after account change", async () => {
  const h = await stateHarness();
  h.delayRevoke();
  const pending = h.render().revoke();
  h.setUser({ id: "B", email: "b@example.com" });
  h.render();
  h.finishRevoke();
  await pending;
  assert.equal(h.render().feedback, undefined);
});

test("settings ignores late feedback after unmount", async () => {
  const h = await stateHarness();
  h.delayGrant();
  const pending = h.render().subscribe();
  h.unmount();
  h.finishGrant();
  await pending;
  assert.equal(h.render().feedback.success, undefined);
});

test("settings success notice cannot contradict a later status refreshed from another tab", async () => {
  const h = await stateHarness();
  await h.render().subscribe();
  assert.equal(h.render().feedback.success, "Подписка включена.");
  h.setStatus({ ...dto, subscribed: false, version: 2, grantRevisionId: "ads-r2" });
  assert.equal(h.render().feedback, undefined);
});
