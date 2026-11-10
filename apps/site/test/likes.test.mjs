import { noopFeatureAnalytics } from "./helpers/noop-feature-analytics.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { setImmediate } from "node:timers";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const query = require("@tanstack/react-query");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
async function load(path, mocks = {}) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (id) => (Object.hasOwn(mocks, id) ? mocks[id] : require(id)),
    mod,
    mod.exports,
  );
  return mod.exports;
}
async function loadLikeButton(mocks) {
  const controller = await load("features/likes/lib/use-like-action.ts", mocks);
  return load("features/likes/ui/like-button.tsx", {
    ...mocks,
    "../lib/use-like-action": controller,
  });
}

const subject = { subjectType: "community-work", subjectId: "work" };
const state = { ...subject, count: 24, viewerHasLiked: false, canLike: true };
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const tick = () => new Promise(setImmediate);
const api = {
  ApiResult: {
    fromDTO: (dto) => ({
      unwrap() {
        if (dto.error) throw dto.error;
        return dto.data;
      },
    }),
  },
};

test("per-object readers batch 60 cards, deduplicate subjects and keep account queues separate", async () => {
  const { createLikesBatchReader } = await load("entities/likes/lib/batch-reader.ts");
  const tasks = [],
    calls = [];
  const read = createLikesBatchReader(
    async (subjects, owner) => {
      calls.push({ subjects, owner });
      return subjects.map((s) => ({ ...state, ...s }));
    },
    (task) => tasks.push(task),
  );
  const inputs = Array.from({ length: 60 }, (_, i) => ({ ...subject, subjectId: `work-${i}` }));
  const promises = inputs.map((s) => read(s, "alice"));
  promises.push(read(inputs[0], "alice"), read(inputs[0], "bob"));
  tasks.splice(0).forEach((run) => run());
  const values = await Promise.all(promises);
  assert.deepEqual(
    calls.map((c) => [c.owner, c.subjects.length]),
    [
      ["alice", 60],
      ["bob", 1],
    ],
  );
  assert.deepEqual(values[0], values[60]);
});

test("batching bounds every request to 100 and does not turn failed or omitted reads into zero likes", async () => {
  const { createLikesBatchReader } = await load("entities/likes/lib/batch-reader.ts");
  const tasks = [],
    calls = [];
  const read = createLikesBatchReader(
    async (subjects) => {
      calls.push(subjects.length);
      return [];
    },
    (task) => tasks.push(task),
  );
  const pending = Array.from({ length: 205 }, (_, i) =>
    read({ ...subject, subjectId: String(i) }, "alice"),
  );
  tasks.splice(0).forEach((run) => run());
  assert.ok((await Promise.all(pending)).every((value) => value === null));
  assert.deepEqual(calls, [100, 100, 5]);
  const failed = createLikesBatchReader(async () => {
    throw new Error("offline");
  });
  await assert.rejects(failed(subject, "alice"), /offline/);
});

async function mutationHarness(action) {
  const client = new query.QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const key = (s, owner) => ["likes", owner, s.subjectType, s.subjectId];
  client.setQueryData(["session", "data"], { user: { id: "alice" } });
  client.setQueryData(key(subject, "alice"), state);
  const errors = [];
  const schemas = await load("entities/likes/model/schemas.ts");
  const { useSetLike } = await load("features/likes/model/use-set-like.ts", {
    "../lib/analytics": noopFeatureAnalytics,
    "@tanstack/react-query": {
      useQueryClient: () => client,
      useIsMutating: (options) => client.isMutating(options),
      useMutation: (options) => ({
        mutateAsync: (input) => client.getMutationCache().build(client, options).execute(input),
      }),
    },
    sonner: { toast: { error: (message) => errors.push(message) } },
    "@/entities/likes": {
      likesQuery: { baseKey: ["likes"], state: (s, owner) => ({ queryKey: key(s, owner) }) },
      ...schemas,
    },
    "@/entities/session": {
      sessionQuery: { baseKey: ["session"], getSession: () => ({ queryKey: ["session", "data"] }) },
    },
    "@/shared/actions/likes": { setLike: action },
    "@/shared/lib/api-result": api,
  });
  function useTestMutation() {
    return useSetLike(subject);
  }
  return { client, key, errors, hook: useTestMutation };
}

test("mutations optimistically update the canonical object once and suppress overlapping clicks", async () => {
  const gate = deferred();
  let calls = 0;
  const h = await mutationHarness(async (s, liked, actor) => {
    calls++;
    assert.equal(actor, "alice");
    assert.equal(liked, true);
    return gate.promise;
  });
  try {
    const first = h.hook().mutate({ actorId: "alice", liked: true });
    await tick();
    assert.equal(h.client.getQueryData(h.key(subject, "alice")).count, 25);
    assert.equal(h.hook().isPending, true);
    assert.equal(await h.hook().mutate({ actorId: "alice", liked: true }), undefined);
    assert.equal(calls, 1);
    gate.resolve({ data: { ...state, count: 25, viewerHasLiked: true } });
    await first;
    assert.equal(h.client.getQueryData(h.key(subject, "alice")).viewerHasLiked, true);
  } finally {
    h.client.clear();
  }
});

test("an old account's response never restores its removed cache or changes the new account", async () => {
  const gate = deferred();
  const h = await mutationHarness(async () => gate.promise);
  try {
    const pending = h.hook().mutate({ actorId: "alice", liked: true });
    await tick();
    h.client.removeQueries({ queryKey: ["likes"] });
    h.client.setQueryData(["session", "data"], { user: { id: "bob" } });
    h.client.setQueryData(h.key(subject, "bob"), state);
    gate.resolve({ data: { ...state, count: 25, viewerHasLiked: true } });
    await pending;
    assert.equal(h.client.getQueryData(h.key(subject, "alice")), undefined);
    assert.deepEqual(h.client.getQueryData(h.key(subject, "bob")), state);
  } finally {
    h.client.clear();
  }
});

test("card and viewer observers share optimistic and confirmed likes and one pending mutation", async () => {
  const gate = deferred();
  let writes = 0;
  const h = await mutationHarness(async () => {
    writes++;
    return gate.promise;
  });
  const options = { queryKey: h.key(subject, "alice"), enabled: false };
  const card = new query.QueryObserver(h.client, options);
  const viewer = new query.QueryObserver(h.client, options);
  const unsubscribe = [card.subscribe(() => {}), viewer.subscribe(() => {})];
  try {
    const pending = h.hook().mutate({ actorId: "alice", liked: true });
    await tick();
    for (const observer of [card, viewer]) {
      assert.equal(observer.getCurrentResult().data.count, 25);
      assert.equal(observer.getCurrentResult().data.viewerHasLiked, true);
    }
    assert.equal(h.hook().isPending, true);
    await h.hook().mutate({ actorId: "alice", liked: false });
    assert.equal(writes, 1, "A second control cannot race the first write");
    gate.resolve({ data: { ...state, count: 25, viewerHasLiked: true } });
    await pending;
    assert.deepEqual(card.getCurrentResult().data, viewer.getCurrentResult().data);
    assert.equal(viewer.getCurrentResult().data.count, 25);
    assert.equal(h.hook().isPending, false);
  } finally {
    unsubscribe.forEach((stop) => stop());
    h.client.clear();
  }
});

test("a lost mutation response reconciles committed server state instead of preserving a false rollback", async () => {
  const h = await mutationHarness(async () => ({
    error: Object.assign(new Error("timeout"), { status: 502 }),
  }));
  const observer = new query.QueryObserver(h.client, {
    queryKey: h.key(subject, "alice"),
    queryFn: async () => ({ ...state, count: 25, viewerHasLiked: true }),
    staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await assert.rejects(h.hook().mutate({ actorId: "alice", liked: true }), /timeout/);
    assert.equal(h.client.getQueryData(h.key(subject, "alice")).viewerHasLiked, true);
    assert.equal(h.errors.length, 1);
  } finally {
    unsubscribe();
    h.client.clear();
  }
});

test("the real card keeps independent buttons and a pill-shaped mobile like target", async () => {
  const { twMerge } = require("tailwind-merge"),
    { clsx } = require("clsx");
  const cn = (...values) => twMerge(clsx(...values));
  const { Button } = await load("shared/ui/button.tsx", { "@/shared/lib/utils": { cn } });
  const { LikeButton } = await loadLikeButton({
    "@tanstack/react-query": { useQueryClient: () => ({}) },
    "@/features/auth": {
      useAuth: () => ({ onAuth: async () => ({ status: "error" }), isPending: false }),
    },
    "@/entities/likes": {
      useLikeState: () => ({ data: state, isPending: false, isError: false }),
      likesQuery: {},
    },
    "@/entities/session": { useSession: () => ({ user: { id: "alice" }, isPending: false }) },
    "@/shared/lib/query-keys": { getQueryOwner: (id) => id ?? "guest" },
    "@/shared/lib": { cn },
    "@/shared/ui": { Button },
    "../model/use-set-like": { useSetLike: () => ({ isPending: false, mutate: async () => {} }) },
  });
  const { CommunityWorkImageCard } = await load("entities/community-work/ui/image-card.tsx", {
    "@/shared/ui": { Button },
    "../lib/selectors": { getCommunityCollectionTitle: () => "Котики 2" },
    "./public-asset-image": {
      PublicAssetImage: () => React.createElement("img", { alt: "Работа" }),
    },
  });
  const html = renderToStaticMarkup(
    React.createElement(CommunityWorkImageCard, {
      work: {
        revisionId: "revision",
        official: { coloring: { title: "Кот" }, collection: { title: "Котики 2" } },
        author: { name: "Автор" },
        submission: { assets: { web: "photo" } },
      },
      onOpenImage: () => {},
      likeAction: React.createElement(LikeButton, { subject, title: "Кот" }),
    }),
  );
  assert.equal((html.match(/<button\b/g) ?? []).length, 2);
  assert.match(html, /min-h-11/);
  assert.match(html, /min-w-14/);
  assert.match(html, /md:min-w-17/);
  assert.match(html, /aria-pressed="false"/);
  assert.ok(
    html.indexOf("</button>") < html.indexOf("aria-pressed="),
    "Like is outside the photo button",
  );
});

async function buttonHarness({
  user = null,
  current = state,
  outcome,
  fresh = state,
  failed = false,
} = {}) {
  const writes = [],
    auth = [],
    reads = [],
    retries = [];
  const { LikeButton } = await loadLikeButton({
    react: { useState: () => [false, () => {}] },
    "@tanstack/react-query": {
      useQueryClient: () => ({
        fetchQuery: async (options) => {
          reads.push(options);
          return fresh;
        },
      }),
    },
    "@/features/auth": {
      useAuth: () => ({
        onAuth: async () => {
          auth.push(true);
          return outcome;
        },
        isPending: false,
      }),
    },
    "@/entities/likes": {
      useLikeState: () => ({
        data: current,
        isPending: false,
        isError: failed,
        refetch: async () => {
          retries.push(true);
        },
      }),
      likesQuery: { state: (s, owner) => ({ queryKey: ["likes", owner, s.subjectId] }) },
    },
    "@/entities/session": { useSession: () => ({ user, isPending: false }) },
    "@/shared/lib/query-keys": { getQueryOwner: (id) => id ?? "guest" },
    "@/shared/lib": { cn: (...values) => values.filter((v) => typeof v === "string").join(" ") },
    "@/shared/ui": { Button: "button" },
    "../model/use-set-like": {
      useSetLike: () => ({
        isPending: false,
        mutate: async (input) => {
          writes.push(input);
        },
      }),
    },
  });
  return { element: LikeButton({ subject, title: "Кот" }), writes, auth, reads, retries };
}

test("a guest cancellation does not write, and successful login preserves add-like intent", async () => {
  const cancelled = await buttonHarness({
    outcome: { status: "error", error: { code: "cancelled" } },
  });
  await cancelled.element.props.onClick();
  assert.deepEqual(cancelled.writes, []);
  const success = await buttonHarness({ outcome: { status: "success", user: { id: "alice" } } });
  await success.element.props.onClick();
  assert.deepEqual(success.writes, [{ actorId: "alice", liked: true }]);
  assert.equal(success.reads[0].staleTime, 0);
  assert.equal(success.reads[0].queryKey[1], "alice");
  const already = await buttonHarness({
    outcome: { status: "success", user: { id: "alice" } },
    fresh: { ...state, viewerHasLiked: true },
  });
  await already.element.props.onClick();
  assert.deepEqual(already.writes, [], "Login must not unlike something the user already liked");
});

test("authenticated clicks remove existing likes while failed reads retry without writing", async () => {
  const active = await buttonHarness({
    user: { id: "alice" },
    current: { ...state, viewerHasLiked: true },
  });
  await active.element.props.onClick();
  assert.deepEqual(active.writes, [{ actorId: "alice", liked: false }]);
  assert.deepEqual(active.auth, []);
  const failed = await buttonHarness({ failed: true });
  await failed.element.props.onClick();
  assert.deepEqual(failed.writes, []);
  assert.deepEqual(failed.auth, []);
  assert.deepEqual(failed.retries, [true]);
  assert.equal(failed.element.props["aria-pressed"], undefined);
});
