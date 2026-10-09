import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
async function load(path, mocks) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (id) => mocks[id] ?? require(id),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const element = (type, props) => ({ type, props });
const { CommunityWorks } = await load("features/product-details/ui/community-works.tsx", {
  "react/jsx-runtime": { jsx: element, jsxs: element },
  "@/entities/community-work": { CommunityWorkCard: "CommunityWorkCard" },
  "@/shared/ui": { Button: "Button" },
  "@/shared/ui/skeleton": { Skeleton: "Skeleton" },
  "@/shared/ui/typography": { SectionTitle: "SectionTitle" },
  "../lib/use-works-scroll": { useWorksScroll: () => ({ trackRef: {}, endRef: {} }) },
});
function render(extra) {
  return CommunityWorks({
    works: [],
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: async () => {},
    ...extra,
  });
}
function find(tree, type) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => find(child, type));
  return [...(tree.type === type ? [tree] : []), ...find(tree.props?.children, type)];
}

test("empty works hide the entire section", () => {
  assert.equal(render(), null);
});
test("every loaded work stays in the horizontal feed without an expand button", () => {
  const works = Array.from({ length: 18 }, (_, i) => ({ publicId: `work-${i}` }));
  const tree = render({ works });
  assert.deepEqual(
    find(tree, "CommunityWorkCard").map((node) => node.props.work),
    works,
  );
  assert.equal(find(tree, "Button").length, 0);
  assert.equal(find(tree, "Skeleton").length, 0);
  const track = find(tree, "div").find((node) => node.props.role === "region");
  assert.equal(track.props["aria-label"], "Лента работ пользователей");
});
test("a next-page failure keeps previous works and offers only retry", async () => {
  let retries = 0;
  const tree = render({
    works: [{ publicId: "one" }],
    hasNextPage: true,
    isFetchNextPageError: true,
    fetchNextPage: async () => retries++,
  });
  assert.equal(find(tree, "CommunityWorkCard").length, 1);
  const button = find(tree, "Button")[0];
  assert.equal(button.props.children, "Повторить");
  button.props.onClick();
  assert.equal(retries, 1);
});
test("horizontal end observer loads automatically, disconnects and stops after the final page or an error", async (t) => {
  let effect;
  let refs;
  let refIndex;
  let callback;
  let options;
  let observed;
  let disconnected = false;
  let requests = 0;
  const previousObserver = globalThis.IntersectionObserver;
  t.after(() => {
    if (previousObserver === undefined) delete globalThis.IntersectionObserver;
    else globalThis.IntersectionObserver = previousObserver;
  });
  globalThis.IntersectionObserver = class {
    constructor(cb, opts) {
      callback = cb;
      options = opts;
    }
    observe(node) {
      observed = node;
    }
    disconnect() {
      disconnected = true;
    }
  };
  const { useWorksScroll: renderScrollHook } = await load("features/product-details/lib/use-works-scroll.ts", {
    react: {
      useRef: () => ({ current: refs[refIndex++] }),
      useEffect: (fn) => {
        effect = fn;
      },
    },
  });
  const call = (extra = {}) => {
    refs = [{ id: "track" }, { id: "end" }];
    refIndex = 0;
    renderScrollHook({
      count: 12,
      hasNextPage: true,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      fetchNextPage: async () => requests++,
      ...extra,
    });
    return effect();
  };
  const cleanup = call();
  assert.equal(options.root, refs[0]);
  assert.equal(observed, refs[1]);
  callback([{ isIntersecting: false }]);
  assert.equal(requests, 0);
  callback([{ isIntersecting: true }]);
  assert.equal(requests, 1);
  cleanup();
  assert.equal(disconnected, true);
  for (const extra of [
    { hasNextPage: false },
    { isFetchingNextPage: true },
    { isFetchNextPageError: true },
    { count: 0 },
  ]) {
    assert.equal(call(extra), undefined);
  }
});
