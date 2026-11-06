import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");
async function load(path, mocks = {}) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", output)(
    (id) => (Object.hasOwn(mocks, id) ? mocks[id] : require(id)),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const base = "features/blog-post/lib/";
const transport = "shared/lib/analytics/";

function install(values) {
  const previous = new Map(Object.keys(values).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, values);
  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  };
}

test("reading order excludes every previously loaded article and namespaces repeated anchors", async () => {
  const { nextReadingPost, headingElementId, readingIndex } = await load(
    `${base}reading-stream.ts`,
  );
  const posts = ["a", "b", "c", "d"].map((slug) => ({ slug }));
  assert.equal(nextReadingPost([posts[0], posts[1]], posts, ["a", "b", "c"]).slug, "d");
  assert.equal(nextReadingPost(posts, posts, ["a", "b", "c", "d"]), undefined);
  assert.notEqual(headingElementId("a", "intro"), headingElementId("b", "intro"));
  assert.equal(readingIndex([0, 850], 300), 0);
  assert.equal(readingIndex([-1000, 200], 300), 1);
});

test("URL changes only on visible article entry; repeat scroll, hidden tabs and history do not add views", async () => {
  const helpers = await load(`${base}reading-stream.ts`);
  const sanitizer = await load(`${transport}sanitize-analytics-url.ts`);
  const virtual = await load(`${transport}virtual-page-view.ts`, {
    "./sanitize-analytics-url": sanitizer,
  });
  const events = new Map();
  const frames = new Map();
  let frameId = 0;
  let cleanup;
  const changes = [];
  const analyticsWindow = {
    scrollY: 0,
    innerHeight: 900,
    location: new URL("https://artmate.ru/blog/a"),
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name) => events.delete(name),
    scrollTo: ({ top }) => {
      analyticsWindow.scrollY = top;
    },
  };
  const history = {
    state: { __NA: true },
    scrollRestoration: "auto",
    replaceState(state, _, url) {
      this.state = state;
      if (url) {
        analyticsWindow.location = new URL(url, analyticsWindow.location);
        changes.push(["replace", url, state]);
      }
    },
    pushState(state, _, url) {
      this.state = state;
      analyticsWindow.location = new URL(url, analyticsWindow.location);
      changes.push(["push", url, state]);
    },
  };
  analyticsWindow.history = history;
  const doc = {
    visibilityState: "visible",
    title: "A",
    querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 72 }) }),
    getElementById: (id) => ({
      getBoundingClientRect: () => ({
        top: (id === "article-a" ? 0 : 2000) - analyticsWindow.scrollY,
      }),
    }),
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name) => events.delete(name),
  };
  const restore = install({
    window: analyticsWindow,
    history,
    document: doc,
    requestAnimationFrame: (fn) => {
      frames.set(++frameId, fn);
      return frameId;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  const flush = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((fn) => fn());
  };
  const scroll = (y) => {
    analyticsWindow.scrollY = y;
    events.get("scroll")();
    flush();
  };
  try {
    const { useCurrentArticle } = await load(`${base}use-current-article.ts`, {
      react: {
        useState: (value) => [value, () => {}],
        useRef: (current) => ({ current }),
        useEffect: (fn) => {
          cleanup = fn();
        },
      },
      "@/shared/constants": { routes: { blogPost: (slug) => `/blog/${slug}` } },
      "@/shared/lib/analytics": virtual,
      "./reading-stream": helpers,
    });
    useCurrentArticle(
      [
        { slug: "a", title: "A" },
        { slug: "b", title: "B" },
      ],
      true,
    );
    flush();
    assert.equal(
      history.state.artmateVirtualPageView,
      undefined,
      "initial SPA navigation must not be suppressed",
    );
    scroll(1500);
    assert.equal(changes.length, 0, "prefetched article is still below reading area");
    doc.visibilityState = "hidden";
    scroll(1900);
    assert.equal(changes.length, 0);
    doc.visibilityState = "visible";
    events.get("visibilitychange")();
    flush();
    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0].slice(0, 2), ["push", "/blog/b"]);
    assert.equal(history.state.artmateVirtualPageView.track, true);
    assert.equal(history.state.__NA, undefined, "Next native adapter must receive fresh state");
    assert.equal(doc.title, "B - Блог Artmate");
    scroll(1950);
    assert.equal(changes.length, 1);
    scroll(200);
    assert.equal(changes.length, 2);
    assert.equal(history.state.artmateVirtualPageView.track, false);
    scroll(1900);
    assert.equal(
      history.state.artmateVirtualPageView.track,
      false,
      "revisiting by scroll is silent",
    );
    history.state = { blogReading: { feed: "a", slug: "a", scrollY: 100 } };
    analyticsWindow.location = new URL("https://artmate.ru/blog/a");
    events.get("popstate")();
    assert.equal(analyticsWindow.scrollY, 100);
    assert.equal(doc.title, "A - Блог Artmate");
    assert.equal(history.state.artmateVirtualPageView.track, false);
    cleanup();
    assert.equal(history.scrollRestoration, "auto");
    assert.equal(events.size, 0);
  } finally {
    restore();
  }
});

test("SPA listener sends exactly one sanitized hit for a visible virtual article and skips silent revisits", async () => {
  const sanitizer = await load(`${transport}sanitize-analytics-url.ts`);
  const virtual = await load(`${transport}virtual-page-view.ts`, {
    "./sanitize-analytics-url": sanitizer,
  });
  const ref = { current: null };
  const { YandexMetrikaPageView } = await load(`${transport}yandex-metrika-page-view.tsx`, {
    react: { useRef: () => ref, useEffect: (fn) => fn() },
    "next/navigation": {
      usePathname: () => "/blog/a",
      useSearchParams: () => new URLSearchParams(),
    },
    "../is-sensitive-path": { isSensitivePath: () => false },
    "./sanitize-analytics-url": sanitizer,
    "./virtual-page-view": virtual,
  });
  const calls = [];
  const w = {
    history: { state: {} },
    location: { href: "https://artmate.ru/blog/a" },
    ym: (...args) => calls.push(args),
  };
  const restore = install({ window: w, document: { title: "B" } });
  try {
    YandexMetrikaPageView({ counterId: 123 });
    w.location.href = "https://artmate.ru/blog/b?email=user%40example.com";
    w.history.state = virtual.virtualPageViewState(w.location.href, true);
    YandexMetrikaPageView({ counterId: 123 });
    YandexMetrikaPageView({ counterId: 123 });
    assert.deepEqual(calls, [
      [
        123,
        "hit",
        "https://artmate.ru/blog/b",
        { referer: "https://artmate.ru/blog/a", title: "B" },
      ],
    ]);
    w.location.href = "https://artmate.ru/blog/a";
    w.history.state = virtual.virtualPageViewState(w.location.href, false);
    YandexMetrikaPageView({ counterId: 123 });
    assert.equal(calls.length, 1);
    w.location.href = "https://artmate.ru/catalog";
    w.history.state = {};
    YandexMetrikaPageView({ counterId: 123 });
    assert.equal(calls.length, 2);
    assert.equal(calls[1][3].referer, "https://artmate.ru/blog/a");
    w.ym = undefined;
    w.location.href = "https://artmate.ru/blog/c";
    assert.doesNotThrow(() => YandexMetrikaPageView({ counterId: 123 }));
  } finally {
    restore();
  }
  assert.equal(virtual.isSilentVirtualPageView("https://artmate.ru/blog/a"), false);
});

test("background loading appends only successful content, blocks concurrent loads, ends without cycles and allows retry", async () => {
  const helpers = await load(`${base}reading-stream.ts`);
  const states = [];
  const effects = [];
  let response;
  let postResult = {
    post: { slug: "b" },
    content: { schemaVersion: 1, blocks: [] },
    relatedPosts: [],
  };
  let list = [{ slug: "a" }, { slug: "b" }];
  let calls = 0;
  const client = {
    fetchQuery: async ({ key }) => {
      calls += 1;
      if (key === "list") return { items: list };
      if (response) await response;
      return postResult;
    },
  };
  const { useReadingStream } = await load("features/blog-post/model/use-reading-stream.ts", {
    react: {
      useState: (initial) => {
        const slot = { value: initial };
        states.push(slot);
        return [
          initial,
          (value) => {
            slot.value = value;
          },
        ];
      },
      useRef: (current) => ({ current }),
      useCallback: (fn) => fn,
      useEffect: (fn) => effects.push(fn),
    },
    "@tanstack/react-query": { useQueryClient: () => client },
    "@/entities/blog": { blogQuery: { getPosts: () => ({ key: "list" }) } },
    "./query": { blogPostPageQuery: () => ({ key: "post" }) },
    "../lib/reading-stream": helpers,
  });
  const initial = { post: { slug: "a" }, content: { blocks: [] }, relatedPosts: [{ slug: "b" }] };
  const stream = useReadingStream(initial);
  let resolve;
  response = new Promise((done) => {
    resolve = done;
  });
  const loading = stream.loadNext();
  await Promise.resolve();
  await stream.loadNext();
  assert.equal(calls, 2, "concurrent observer callbacks do not issue another fetch");
  assert.equal(states[0].value.length, 1, "pending data is never appended or activated");
  resolve();
  await loading;
  assert.equal(states[0].value.length, 2);
  await stream.loadNext();
  assert.equal(states[1].value, "done");
  assert.equal(states[0].value.length, 2, "loaded articles are not repeated");
  list = [...list, { slug: "c" }];
  response = null;
  postResult = { post: undefined, content: undefined, relatedPosts: [] };
  await stream.loadNext();
  assert.equal(states[1].value, "error");
  assert.equal(states[0].value.length, 2, "404 does not append an article");
  postResult = { post: { slug: "c" }, content: { blocks: [] }, relatedPosts: [] };
  await stream.loadNext();
  assert.equal(states[0].value.length, 3, "retry can recover after an error");
});
