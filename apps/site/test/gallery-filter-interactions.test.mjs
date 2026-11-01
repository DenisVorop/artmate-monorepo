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
    (id) => (Object.hasOwn(mocks, id) ? mocks[id] : require(id)),
    mod,
    mod.exports,
  );
  return mod.exports;
}

test("query state keeps every selected album and updates client filters without server navigation", async () => {
  let url = new URL("https://artmate.example/gallery?album=cats&album=flowers&tag=a&tag=b#works");
  const navigations = [];
  const previousWindow = globalThis.window;
  globalThis.window = {
    get location() {
      return url;
    },
    history: {
      replaceState: (_state, _title, next) => {
        url = new URL(next, url);
      },
    },
  };
  try {
    const { QueryStateProvider } = await load(
      "shared/lib/query-state-manager/query-state.provider.tsx",
      {
        react: { useMemo: (fn) => fn(), useCallback: (fn) => fn },
        "next/navigation": {
          usePathname: () => url.pathname,
          useSearchParams: () => new URLSearchParams(url.search),
          useRouter: () => ({ replace: (...args) => navigations.push(args) }),
        },
        "../hooks/use-stable-callback": { useStableCallback: (fn) => fn },
        "../object-entries": { objectEntries: Object.entries },
        "./query-state.context": { QueryStateContext: { Provider: "provider" } },
      },
    );
    const [params, methods] = QueryStateProvider({}).props.value;
    assert.deepEqual(params.album, ["cats", "flowers"]);
    assert.deepEqual(params.tag, ["a", "b"]);
    methods.addMany({ album: ["cats", "flowers", "landscapes"] }, { shallow: true });
    methods.addMany({ picture: "2" }, { shallow: true });
    assert.deepEqual(navigations, []);
    assert.equal(url.pathname, "/gallery");
    assert.equal(url.hash, "#works");
    assert.deepEqual(url.searchParams.getAll("album"), ["cats", "flowers", "landscapes"]);
    assert.deepEqual(url.searchParams.getAll("tag"), ["a", "b"]);
    assert.equal(url.searchParams.get("picture"), "2");
    methods.addMany({ picture: "3" });
    assert.equal(navigations.length, 1, "Existing callers still use router navigation");
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("rapid album and number changes compose before a render or URL acknowledgement", async () => {
  const slots = [];
  let slot = 0;
  let params = {};
  const writes = [];
  const galleryState = await load("features/community-gallery/lib/gallery-state.ts", {});
  const { useGalleryFilterState } = await load(
    "features/community-gallery/lib/use-gallery-filter-state.ts",
    {
      react: {
        useRef(value) {
          const index = slot++;
          return (slots[index] ??= { current: value });
        },
        useState(value) {
          const index = slot++;
          if (!(index in slots)) slots[index] = value;
          return [
            slots[index],
            (next) => {
              slots[index] = next;
            },
          ];
        },
      },
      "@/shared/lib/query-state-manager": {
        useQueryState: () => [params, { addMany: (...args) => writes.push(args) }],
      },
      "./gallery-state": galleryState,
    },
  );
  const TestGalleryState = (preset) => {
    slot = 0;
    return useGalleryFilterState(preset);
  };
  const first = TestGalleryState();
  first.updateFilters((current) => ({ ...current, collections: ["cats"] }));
  first.updateFilters((current) => ({
    ...current,
    collections: [...current.collections, "flowers"],
  }));
  first.updateFilters((current) => ({ ...current, number: 2 }));
  first.updateFilters((current) => ({
    ...current,
    collections: current.collections.filter((slug) => slug !== "cats"),
  }));
  assert.deepEqual(TestGalleryState().filters, { collections: ["flowers"], number: 2 });
  assert.deepEqual(writes.at(-1), [{ album: ["flowers"], picture: "2" }, { shallow: true }]);
  params = writes.at(-1)[0];
  assert.deepEqual(TestGalleryState().filters, { collections: ["flowers"], number: 2 });
  TestGalleryState().clearFilters();
  assert.deepEqual(TestGalleryState().filters, { collections: [] });
  params = {};
  assert.deepEqual(TestGalleryState("landscapes").filters, {
    collections: ["landscapes"],
    number: undefined,
  });
});
