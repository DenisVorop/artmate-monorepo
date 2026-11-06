import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/features/community-gallery/lib/use-works-scroll.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function mount(options) {
  let cleanup;
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    () => ({
      useRef: () => ({ current: {} }),
      useEffect: (effect) => {
        cleanup = effect();
      },
    }),
    mod,
    mod.exports,
  );
  mod.exports.useWorksScroll(options);
  return cleanup;
}

test("scroll preloads once per observer and disconnects before requesting another page", () => {
  const original = globalThis.IntersectionObserver;
  let callback;
  const events = [];
  globalThis.IntersectionObserver = class {
    constructor(onIntersect, options) {
      callback = onIntersect;
      assert.equal(options.rootMargin, "800px 0px");
    }
    observe() {
      events.push("observe");
    }
    disconnect() {
      events.push("disconnect");
    }
  };
  try {
    const cleanup = mount({
      count: 60,
      hasNextPage: true,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      paused: false,
      fetchNextPage: async () => {
        events.push("fetch");
      },
    });
    callback([{ isIntersecting: false }]);
    assert.deepEqual(events, ["observe"]);
    callback([{ isIntersecting: true }]);
    callback([{ isIntersecting: true }]);
    assert.deepEqual(events, ["observe", "disconnect", "fetch"]);
    cleanup();
    assert.equal(events.at(-1), "disconnect");
    const stopBeforeIntersection = mount({
      count: 60,
      hasNextPage: true,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      paused: false,
      fetchNextPage: async () => assert.fail("A queued callback must not fetch after cleanup"),
    });
    stopBeforeIntersection();
    callback([{ isIntersecting: true }]);
  } finally {
    if (original === undefined) delete globalThis.IntersectionObserver;
    else globalThis.IntersectionObserver = original;
  }
});

test("scroll stops at the end, while loading, after a failure, and while preview is open", () => {
  const original = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    constructor() {
      assert.fail("Autoload must remain stopped");
    }
  };
  const base = {
    count: 60,
    hasNextPage: true,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    paused: false,
    fetchNextPage: async () => assert.fail("Unexpected fetch"),
  };
  try {
    for (const state of [
      { count: 0 },
      { hasNextPage: false },
      { isFetchingNextPage: true },
      { isFetchNextPageError: true },
      { paused: true },
    ])
      mount({ ...base, ...state });
  } finally {
    if (original === undefined) delete globalThis.IntersectionObserver;
    else globalThis.IntersectionObserver = original;
  }
});
