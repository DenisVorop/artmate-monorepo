import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function evaluate(source, mocks = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const result = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => {
      assert.ok(Object.hasOwn(mocks, name), name);
      return mocks[name];
    },
    result,
    result.exports,
  );
  return result.exports;
}

test("palette choice and both split positions survive comparison toggles, including original/original", async () => {
  const values = [];
  let cursor = 0;
  const { usePaletteState: getPaletteState } = evaluate(
    await readSource("src/features/coloring-variants/lib/use-palette-state.ts"),
    {
      react: {
        useState: (initial) => {
          const index = cursor++;
          if (!(index in values)) values[index] = initial;
          return [
            values[index],
            (value) => {
              values[index] = typeof value === "function" ? value(values[index]) : value;
            },
          ];
        },
      },
    },
  );
  const original = { id: "original", label: "Оригинал" };
  const artmate = { id: "artmate", label: "Artmate 168" };
  const other = { id: "pencils", label: "Карандаши" };
  const coloring = { defaultPaletteId: "artmate", original, variants: [artmate, other] };
  const render = () => {
    cursor = 0;
    return getPaletteState(coloring);
  };
  let state = render();
  assert.equal(state.palette, artmate);
  state.setSplit(21);
  state.toggleComparison();
  state = render();
  assert.equal(state.split, 50);
  state.setSplit(78);
  state.selectPalette("pencils");
  state = render();
  assert.equal(state.palette, other);
  assert.equal(state.split, 78);
  state.selectPalette("original");
  state = render();
  assert.equal(state.palette, original);
  assert.equal(state.isComparing, true);
  state.toggleComparison();
  state = render();
  assert.equal(state.split, 21);
  assert.equal(state.palette, original);
  state.selectPalette("unpublished");
  assert.equal(render().palette, original);
  state.toggleComparison();
  assert.equal(render().split, 78);
});

test("comparison readiness ignores stale retry events and captions identify current sides", async () => {
  const state = evaluate(
    await readSource("src/features/coloring-variants/lib/comparison-state.ts"),
  );
  const pending = state.createComparisonImageState();
  const rightLoaded = state.comparisonImageReducer(pending, {
    type: "loaded",
    kind: "colored",
    attempt: 0,
  });
  assert.equal(state.areComparisonImagesReady(rightLoaded), false);
  const ready = state.comparisonImageReducer(rightLoaded, {
    type: "loaded",
    kind: "outline",
    attempt: 0,
  });
  assert.equal(state.areComparisonImagesReady(ready), true);
  const failed = state.comparisonImageReducer(ready, { type: "failed", attempt: 0 });
  assert.equal(state.areComparisonImagesReady(failed), false);
  const retry = state.comparisonImageReducer(failed, { type: "retry" });
  assert.deepEqual(
    state.comparisonImageReducer(retry, { type: "loaded", kind: "outline", attempt: 0 }),
    retry,
  );
  assert.equal(
    state.getComparisonValueText(75, "Оригинал", "Artmate 168"),
    "Оригинал: 75%, Artmate 168: 25%",
  );
  assert.equal(state.getComparisonKeyboardValue("Home", 70), 0);
  assert.equal(state.getComparisonKeyboardValue("End", 20), 100);
  assert.equal(state.getComparisonKeyboardValue("ArrowLeft", 0), 0);
  assert.equal(state.getComparisonKeyboardValue("PageUp", 95), 100);
});

test("preview isolates the data flow, retains community composition and two linked controls", async () => {
  const [route, page, viewer, comparison, productLinks] = await Promise.all([
    readSource("app/coloring-palette-preview/[collectionSlug]/[number]/page.tsx"),
    readSource("src/_pages/coloring-variants/index.tsx"),
    readSource("src/features/coloring-variants/ui/palette-viewer.tsx"),
    readSource("src/features/coloring-variants/ui/comparison-viewer.tsx"),
    readSource("src/features/coloring-variants/ui/product-links.tsx"),
  ]);
  assert.match(route, /robots: \{ index: false, follow: false \}/);
  assert.match(route, /dehydrateQueryClient\(queryClient\)/);
  assert.match(page, /<CommunityWorks slug=\{collectionSlug\} number=\{number\}/);
  assert.doesNotMatch(page, /useQuery|useState|useColoringVariantsData/);
  assert.doesNotMatch(viewer, /@\/features\//);
  assert.equal((comparison.match(/<ComparisonSlider/g) ?? []).length, 2);
  assert.equal((comparison.match(/value=\{split\}/g) ?? []).length, 2);
  assert.match(viewer, /key=\{`\$\{left.url\}:\$\{right.url\}`\}/);
  assert.match(productLinks, /getProductById/);
  assert.match(productLinks, /sizes=/);
  assert.doesNotMatch(productLinks, /unoptimized|loading="eager"|fetch\(/);
});

test("viewer changes contour and colored sample together and compares only against the original sample", async () => {
  const values = [];
  let cursor = 0;
  const state = evaluate(
    await readSource("src/features/coloring-variants/lib/use-palette-state.ts"),
    {
      react: {
        useState: (initial) => {
          const index = cursor++;
          if (!(index in values)) values[index] = initial;
          return [
            values[index],
            (value) => {
              values[index] = typeof value === "function" ? value(values[index]) : value;
            },
          ];
        },
      },
    },
  );
  const jsx = (type, props, key) => ({ type, props, key });
  const controls = Object.fromEntries(
    ["Button", "Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"].map(
      (name) => [name, name],
    ),
  );
  const events = [];
  const { PaletteViewer } = evaluate(
    await readSource("src/features/coloring-variants/ui/palette-viewer.tsx"),
    {
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "lucide-react": { ArrowLeftRight: "ArrowLeftRight" },
      "@/shared/ui": controls,
      "../lib/use-palette-state": state,
      "../lib/analytics": {
        useViewerAnalytics: () => ({
          paletteSelected: (id) => events.push(["palette", id]),
          comparisonOpened: () => events.push(["comparison", true]),
          comparisonClosed: () => events.push(["comparison", false]),
        }),
      },
      "./comparison-viewer": { ComparisonViewer: "ComparisonViewer" },
      "./hero": { Hero: "Hero" },
      "./palette-section": { PaletteSection: "PaletteSection" },
      "./product-links": { ProductLinks: "ProductLinks" },
    },
  );
  const asset = (url) => ({ url, alt: url });
  const original = {
    id: "original",
    label: "Оригинал",
    image: asset("original-color"),
    outline: asset("original-outline"),
  };
  const artmate = {
    id: "artmate",
    label: "Artmate 168",
    image: asset("artmate-color"),
    outline: asset("artmate-outline"),
  };
  const coloring = {
    defaultPaletteId: "original",
    original,
    variants: [artmate],
    collection: {},
    number: 1,
    width: 100,
    height: 200,
  };
  const find = (node, type) => {
    if (!node || typeof node !== "object") return undefined;
    if (node.type === type) return node;
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) {
      const found = find(child, type);
      if (found) return found;
    }
  };
  const render = () => {
    cursor = 0;
    return PaletteViewer({ coloring });
  };
  const check = (tree, left, right) => {
    const viewer = find(tree, "ComparisonViewer");
    assert.equal(viewer.props.left, left);
    assert.equal(viewer.props.right, right);
    assert.equal(viewer.key, `${left.url}:${right.url}`);
  };
  const select = (tree, id) => find(tree, "Select").props.onValueChange(id);
  const compare = (tree) => find(tree, "Button").props.onClick();
  let tree = render();
  check(tree, original.outline, original.image);
  select(tree, "artmate");
  tree = render();
  check(tree, artmate.outline, artmate.image);
  select(tree, "original");
  tree = render();
  check(tree, original.outline, original.image);
  select(tree, "artmate");
  tree = render();
  compare(tree);
  tree = render();
  check(tree, original.image, artmate.image);
  select(tree, "original");
  tree = render();
  check(tree, original.image, original.image);
  select(tree, "artmate");
  tree = render();
  compare(tree);
  check(render(), artmate.outline, artmate.image);
  assert.deepEqual(events, [
    ["palette", "artmate"], ["palette", "original"], ["palette", "artmate"],
    ["comparison", true], ["palette", "original"], ["palette", "artmate"], ["comparison", false],
  ]);
});
