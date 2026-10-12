import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function loadRoute({
  viewerMode = "revision",
  variants = { token: "materials-2" },
  error,
  missing = false,
} = {}) {
  const source = await readFile(
    new URL("../app/(site)/raskraski/digital/[collectionSlug]/[number]/page.tsx", import.meta.url),
    "utf8",
  );
  const calls = [];
  const queryClient = { id: "shared-cache" };
  const coloring = missing
    ? null
    : {
        viewerMode,
        number: 1,
        collection: { slug: "forest" },
        publishedRevisionId: "revision-2",
        colored: { url: "https://example.test/original.webp" },
      };

  class ColoringDataBuilder {
    withColoring(slug, number) {
      calls.push(["detail", slug, number]);
      return this;
    }
    withProducts() {
      calls.push(["products"]);
      return this;
    }
    async build() {
      return { coloring, queryClient };
    }
  }
  class ColoringVariantsDataBuilder {
    constructor(_child, _tasks, cache) {
      assert.equal(cache, queryClient);
    }
    withColoringVariants(slug, number) {
      calls.push(["variants", slug, number]);
      return this;
    }
    async build() {
      if (error) throw error;
      return { coloring: variants };
    }
  }
  class CommunityDataBuilder {
    constructor(_child, _tasks, cache) {
      assert.equal(cache, queryClient);
    }
    withRelatedWorks(slug, number) {
      calls.push(["works", slug, number]);
      return this;
    }
    async build() {
      return { queryClient };
    }
  }
  const jsx = (type, props) => ({ type, props });
  const imports = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "@tanstack/react-query": { HydrationBoundary: "HydrationBoundary" },
    "next/navigation": {
      notFound: () => {
        throw new Error("NOT_FOUND");
      },
    },
    "@/app/lib/coloring-data-builder": { ColoringDataBuilder },
    "@/app/lib/coloring-variants-data-builder": { ColoringVariantsDataBuilder },
    "@/app/lib/community-data-builder": { CommunityDataBuilder },
    "@/pages/coloring": { ColoringPage: "ColoringPage" },
    "@/pages/coloring-variants": { ColoringVariantsPage: "ColoringVariantsPage" },
    "@/shared/constants": {
      parseColoringNumber: (value) =>
        /^\d{2}$/.test(value) && Number(value) > 0 ? Number(value) : null,
    },
    "@/shared/lib/dehydrate-query-client": {
      dehydrateQueryClient: (cache) => {
        assert.equal(cache, queryClient);
        return "hydrated";
      },
    },
    "@/shared/lib/seo": {
      ColoringStructuredData: "ColoringStructuredData",
      createColoringMetadata: (detail) => ({ image: detail.colored.url }),
    },
  };
  const output = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (specifier) => {
      assert.ok(Object.hasOwn(imports, specifier), `Unexpected import: ${specifier}`);
      return imports[specifier];
    },
    loaded,
    loaded.exports,
  );
  return { ...loaded.exports, coloring, calls };
}

const params = () => Promise.resolve({ collectionSlug: "forest", number: "01" });

for (const viewerMode of ["materials", "revision"]) {
  test(`digital route selects ${viewerMode} and preserves products, works, SEO and hydration`, async () => {
    const route = await loadRoute({ viewerMode });
    const result = await route.default({ params: params() });
    const [structured, hydration] = result.props.children;
    assert.equal(structured.type, "ColoringStructuredData");
    assert.equal(structured.props.coloring, route.coloring);
    assert.equal(hydration.type, "HydrationBoundary");
    assert.equal(hydration.props.state, "hydrated");
    assert.equal(
      hydration.props.children.type,
      viewerMode === "materials" ? "ColoringVariantsPage" : "ColoringPage",
    );
    assert.deepEqual(hydration.props.children.props, {
      collectionSlug: "forest",
      number: 1,
      ...(viewerMode === "materials"
        ? { token: "materials-2" }
        : { publishedRevisionId: "revision-2" }),
    });
    assert.deepEqual(route.calls, [
      ["detail", "forest", 1],
      ["products"],
      ...(viewerMode === "materials" ? [["variants", "forest", 1]] : []),
      ["works", "forest", 1],
    ]);
    assert.deepEqual(await route.generateMetadata({ params: params() }), {
      image: "https://example.test/original.webp",
    });
  });
}

test("materials viewer failures propagate and missing materials are explicit errors", async () => {
  for (const status of [404, 502, 503]) {
    const error = Object.assign(new Error("materials unavailable"), { status });
    const route = await loadRoute({ viewerMode: "materials", error });
    await assert.rejects(
      () => route.default({ params: params() }),
      (caught) => caught === error,
    );
    assert.equal(
      route.calls.some(([name]) => name === "works"),
      false,
    );
  }
  const route = await loadRoute({ viewerMode: "materials", variants: null });
  await assert.rejects(
    () => route.default({ params: params() }),
    /Coloring materials viewer is unavailable for "forest\/1"/,
  );
});

test("missing public detail and invalid route are 404 without requesting materials", async () => {
  const missing = await loadRoute({ missing: true });
  await assert.rejects(() => missing.default({ params: params() }), /NOT_FOUND/);
  assert.equal(
    missing.calls.some(([name]) => name === "variants"),
    false,
  );
  const invalid = await loadRoute({ viewerMode: "materials" });
  const invalidParams = Promise.resolve({ collectionSlug: "forest", number: "invalid" });
  await assert.rejects(() => invalid.default({ params: invalidParams }), /NOT_FOUND/);
  assert.deepEqual(invalid.calls, []);
  assert.deepEqual(await invalid.generateMetadata({ params: invalidParams }), {});
});
