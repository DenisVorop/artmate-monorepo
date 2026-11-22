import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
async function load(path, mocks = {}) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    mod,
    mod.exports,
  );
  return mod.exports;
}
async function setup({ accepted = true } = {}) {
  const consent = { current: accepted };
  const types = await load("shared/lib/analytics/types.ts");
  const shared = await load("shared/lib/analytics/create-analytics.ts", {
    "@/shared/lib/cookie-consent": { getCookieConsentSnapshot: () => consent.current },
    "./types": types,
    "./dedupe": await load("shared/lib/analytics/dedupe.ts"),
    "./product": await load("shared/lib/analytics/product.ts"),
    "./sanitize-analytics-url": await load("shared/lib/analytics/sanitize-analytics-url.ts"),
  });
  const { useAnalytics: getAnalytics } = await load("features/contests/lib/analytics.ts", {
    "@/shared/lib/analytics": shared,
  });
  return { consent, shared, useAnalytics: getAnalytics, analytics: getAnalytics() };
}
async function withWindow(run, { noCounter = false, broken = false } = {}) {
  const original = globalThis.window;
  const calls = [];
  const blockedStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  const win = {
    dataLayer: [],
    localStorage: blockedStorage,
    sessionStorage: blockedStorage,
    document: { getElementById: () => (noCounter ? null : { getAttribute: () => "12345" }) },
    ...(!noCounter && {
      ym: (...args) => {
        if (broken) throw new Error("blocked");
        calls.push(args);
      },
    }),
  };
  globalThis.window = win;
  try {
    await run(win, calls);
  } finally {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  }
}
const slug = "winter-work";
const publicId = "abcdefabcdefabcdefabcdef";
const createdEntry = { id: "private-entry-id", publicId, version: 1, status: "PENDING" };

test("contest events use exact consented interaction payloads and public contest context only", async () => {
  const { analytics, shared } = await setup();
  await withWindow((win, calls) => {
    analytics.viewed(slug, "view-1");
    analytics.entryStarted(slug, "attempt-1");
    analytics.entrySubmitted(slug, publicId);
    const events = ["contest_view", "contest_entry_start", "contest_entry_submit_success"];
    assert.deepEqual(
      win.dataLayer,
      events.map((event) => ({ event, contest_slug: slug })),
    );
    assert.deepEqual(
      calls,
      events.map((event) => [
        12345,
        "params",
        {
          artmate_action: event,
          artmate_action_context: { [event]: { contest_slug: slug } },
        },
      ]),
    );
    shared
      .createAnalytics({
        unsafe: () =>
          shared.createInteractionCommand("contest_view", {
            contest_slug: slug,
            email: "buyer@example.test",
            user_id: "private-user-id",
            caption: "secret",
          }),
      })
      .send("unsafe");
    assert.deepEqual(win.dataLayer.at(-1), { event: "contest_view", contest_slug: slug });
    assert.doesNotMatch(JSON.stringify([win.dataLayer, calls]), /buyer@|private-|secret|abcdef/);
  });
});

test("events deduplicate per view, opening and public entry without blocking real repeat visits", async () => {
  const { analytics } = await setup();
  await withWindow((win) => {
    for (let repeat = 0; repeat < 2; repeat++) {
      analytics.viewed(slug, "view-1");
      analytics.entryStarted(slug, "attempt-1");
      analytics.entrySubmitted(slug, publicId);
    }
    assert.equal(win.dataLayer.length, 3);
    analytics.viewed(slug, "view-2");
    analytics.entryStarted(slug, "attempt-2");
    analytics.viewed("spring-work", "view-1");
    assert.equal(win.dataLayer.length, 6);
  });
});

test("consent and SSR skip events without consuming dedupe keys; unavailable counters do not break actions", async () => {
  const original = globalThis.window;
  const { analytics, consent } = await setup({ accepted: false });
  delete globalThis.window;
  try {
    assert.doesNotThrow(() => analytics.viewed(slug, "view-1"));
  } finally {
    if (original !== undefined) globalThis.window = original;
  }
  await withWindow(
    (win) => {
      analytics.viewed(slug, "view-1");
      analytics.entryStarted(slug, "attempt-1");
      analytics.entrySubmitted(slug, publicId);
      assert.deepEqual(win.dataLayer, []);
      consent.current = true;
      analytics.viewed(slug, "view-1");
      assert.equal(win.dataLayer.length, 1);
    },
    { noCounter: true },
  );
  await withWindow(
    (win) => {
      assert.doesNotThrow(() => analytics.entrySubmitted(slug, publicId));
      assert.equal(win.dataLayer.length, 1);
    },
    { broken: true },
  );
});

test("invalid contest identifiers are discarded and valid 120-character routes are supported", async () => {
  const { analytics } = await setup();
  await withWindow((win) => {
    for (const value of [
      "",
      "buyer@example.test",
      "+79990000000",
      "https://site.test/private",
      "a".repeat(121),
    ]) {
      analytics.viewed(value, "view-1");
      analytics.entryStarted(value, "attempt-1");
      analytics.entrySubmitted(value, publicId);
    }
    analytics.viewed(slug, "buyer@example.test");
    assert.equal(win.dataLayer.length, 0);
    analytics.viewed("a".repeat(120), "view-120");
    assert.deepEqual(win.dataLayer, [{ event: "contest_view", contest_slug: "a".repeat(120) }]);
  });
});

async function hookHarness(path, name, env) {
  const refs = [];
  let cursor = 0;
  let effects = [];
  const hooks = await load(path, {
    react: {
      useRef(initial) {
        return (refs[cursor++] ??= { current: initial });
      },
      useEffect(effect) {
        effects.push(effect);
      },
    },
    "./analytics": { useAnalytics: env.useAnalytics },
    "@/shared/lib/cookie-consent": {
      useCookieConsent: () => ({ isAccepted: env.consent.current }),
    },
  });
  return (...args) => {
    cursor = 0;
    effects = [];
    hooks[name](...args);
    effects.forEach((effect) => effect());
  };
}

test("view waits for successful entity loading and consent; effect replay and refresh do not duplicate it", async () => {
  const env = await setup({ accepted: false });
  const render = await hookHarness(
    "features/contests/lib/use-track-contest-view.ts",
    "useTrackContestView",
    env,
  );
  await withWindow((win) => {
    render(undefined);
    render(slug);
    assert.equal(win.dataLayer.length, 0);
    env.consent.current = true;
    render(slug);
    render(slug);
    render(undefined);
    render(slug);
    assert.deepEqual(win.dataLayer, [{ event: "contest_view", contest_slug: slug }]);
    render("spring-work");
    render(slug);
    assert.equal(win.dataLayer.length, 3);
  });
});

test("start waits for the actual new-entry form and consent, and reopening is a new attempt", async () => {
  const env = await setup({ accepted: false });
  const render = await hookHarness(
    "features/contests/lib/use-track-contest-entry-start.ts",
    "useTrackContestEntryStart",
    env,
  );
  await withWindow((win) => {
    render(undefined, true);
    render(slug, false);
    render(slug, true);
    assert.equal(win.dataLayer.length, 0);
    env.consent.current = true;
    render(slug, true);
    render(slug, true);
    assert.equal(win.dataLayer.length, 1);
    render(slug, false);
    render(slug, true);
    assert.equal(win.dataLayer.length, 2);
  });
});

async function mutationHarness(env, respond) {
  const cache = [],
    closed = [],
    options = {};
  const { useSubmitContestEntry: createMutation } = await load(
    "features/contests/model/use-submit-contest-entry.ts",
    {
      "@tanstack/react-query": {
        useQueryClient: () => ({ setQueryData: (...args) => cache.push(args) }),
        useMutation: (settings) => {
          Object.assign(options, settings);
          return {
            isPending: false,
            mutateAsync: async (input) => {
              const entry = await settings.mutationFn(input);
              settings.onSuccess(entry, input);
              return entry;
            },
          };
        },
      },
      "@/entities/contest": { contestEntryQuery: { mine: () => ({ queryKey: ["entry"] }) } },
      "@/shared/actions/contests": { submitContestEntry: respond },
      "@/shared/lib/api-result": {
        ApiResult: {
          fromDTO: (dto) => ({
            unwrap: () => {
              if (dto.error) throw dto.error;
              return dto.data;
            },
          }),
        },
      },
      "../lib/analytics": { useAnalytics: env.useAnalytics },
    },
  );
  return {
    ...createMutation(slug, "private-user-id", () => closed.push(true)),
    cache,
    closed,
    options,
  };
}

test("success waits for the server and emits once, while edits, failed and malformed responses are not new submissions", async () => {
  const env = await setup();
  await withWindow(async (win) => {
    let resolve;
    const response = new Promise((done) => {
      resolve = done;
    });
    const h = await mutationHarness(env, () => response);
    const input = { albumId: "album-1", caption: "secret", photo: {} };
    const request = h.mutate(input);
    assert.equal(win.dataLayer.length, 0);
    resolve({ data: createdEntry });
    assert.equal(await request, createdEntry);
    h.options.onSuccess(createdEntry, input);
    assert.deepEqual(win.dataLayer, [
      { event: "contest_entry_submit_success", contest_slug: slug },
    ]);
    assert.equal(h.cache[0][1], createdEntry);
    assert.equal(h.closed.length, 2);
    const edit = await mutationHarness(env, async () => ({
      data: { ...createdEntry, version: 2 },
    }));
    await edit.mutate({ ...input, version: 1 });
    const failed = await mutationHarness(env, async () => ({ error: new Error("rejected") }));
    await assert.rejects(failed.mutate(input), /rejected/);
    assert.equal(failed.closed.length, 0);
    for (const data of [undefined, {}, { ...createdEntry, publicId: "buyer@example.test" }]) {
      const malformed = await mutationHarness(env, async () => ({ data }));
      await malformed.mutate(input);
    }
    assert.equal(win.dataLayer.length, 1);
  });
});

test("contest UI ignores loading/errors and starts only the authenticated ready new-entry form", async () => {
  let query = { contest: undefined, isPending: true, isError: false };
  let entryQuery = { entry: null, isPending: false, isError: false };
  let userId;
  let entryOpen = false;
  const views = [],
    starts = [];
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "next/image": { default: "image" },
    "@repo/ui/contest-prizes": { ContestPrizeList: "prize-list" },
    "@/features/auth": { withAuth: (Component) => Component },
    "@/entities/contest": {
      useContest: () => query,
      useMyContestEntry: () => entryQuery,
      useMyContestPhoto: () => ({}),
    },
    "@/shared/constants": {
      routes: {
        home: "/",
        contests: "/contests",
        catalogColorings: "/catalog",
        legal: {
          contestRules: "/legal/contest-rules",
          contestConditions: (slug, id) => `/legal/contest-conditions/${slug}/${id}`,
        },
      },
    },
    "@/shared/ui": new Proxy({}, { get: (_target, name) => String(name) }),
    "@/shared/ui/link": { Link: "link" },
    "../lib/entry-form": { toContestEntryInput: (values) => values },
    "../lib/contest-state": {
      useContestDetailsState: () => ({
        entryOpen,
        userId,
        entryTriggerRef: { current: null },
        workTriggerRef: { current: null },
        tab: "works",
      }),
    },
    "../lib/format-date": { formatContestDate: () => "date" },
    "../lib/use-track-contest-view": { useTrackContestView: (value) => views.push(value) },
    "../lib/use-track-contest-entry-start": {
      useTrackContestEntryStart: (...args) => starts.push(args),
    },
    "../model/use-submit-contest-entry": { useSubmitContestEntry: () => ({}) },
  };
  for (const [path, name] of [
    ["./contest-status", "ContestStatus"],
    ["./contest-surface", "ContestSurface"],
    ["./entry-dialog", "EntryDialog"],
    ["./work-preview", "WorkPreview"],
    ["./entry-summary", "EntrySummary"],
    ["./results", "ContestResults"],
  ])
    mocks[path] = { [name]: name };
  const { ContestDetails } = await load("features/contests/ui/contest-details.tsx", mocks);
  const render = () => ContestDetails({ slug });
  render();
  assert.equal(views.at(-1), undefined);
  assert.equal(starts.at(-1)[1], false);
  const contest = {
    slug,
    stage: "open",
    works: [],
    rules: [],
    draw: null,
    prizePresentation: { mode: "equal", winners: [{ title: "Альбом" }] },
  };
  query = { contest, isPending: false, isError: true };
  render();
  assert.equal(views.at(-1), undefined);
  query.isError = false;
  entryOpen = true;
  render();
  assert.equal(views.at(-1), slug);
  assert.equal(starts.at(-1)[1], false, "Guest intent must wait for authentication");
  userId = "private-user-id";
  entryQuery.isPending = true;
  render();
  assert.equal(starts.at(-1)[1], false, "Existing entry must be checked first");
  entryQuery.isPending = false;
  entryQuery.isError = true;
  render();
  assert.equal(starts.at(-1)[1], false);
  entryQuery.isError = false;
  render();
  assert.deepEqual(starts.at(-1), [slug, true]);
  entryQuery.entry = { ...createdEntry, canEdit: true };
  render();
  assert.equal(starts.at(-1)[1], false, "Editing is not a new submission start");
  entryQuery.entry = null;
  entryOpen = false;
  render();
  assert.equal(starts.at(-1)[1], false);
});
