import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { z } = require("zod");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, mocks = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const testModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) {
      return mocks[specifier];
    }

    throw new Error(`Unexpected test module import: ${specifier}`);
  };

  new Function("require", "module", "exports", output)(
    localRequire,
    testModule,
    testModule.exports,
  );

  return testModule.exports;
}

const summary = {
  id: "collection-1",
  slug: "forest",
  title: "Загадочный лес",
  description: "25 лесных сюжетов",
  coloringCount: 1,
  expectedColoringCount: 25,
  cover: {
    url: "https://api.example.test/coloring-collections/forest/cover/content",
    alt: "Обложка тематики Загадочный лес",
    width: 900,
    height: 1200,
  },
  product: {
    id: "product-1",
    slug: "forest-album",
    title: "Лесной альбом",
    category: { id: "category-1", slug: "albums", title: "Альбомы" },
  },
  lastModified: "2026-08-29T12:00:00.000Z",
};
const collection = {
  ...summary,
  colorings: [
    {
      id: "coloring-1",
      number: 7,
      title: "Лиса и сова",
      position: 1,
      publishedRevisionId: "revision-2",
      card: {
        url: "https://api.example.test/colorings/forest/07/assets/revision-2/card/content",
        alt: "Лиса и сова в цвете",
        width: 480,
        height: 640,
      },
    },
  ],
};

function createApiResultMock() {
  return {
    prepareApi: (callback) => async () => {
      try {
        const data = await callback();

        return {
          toDTO: () => ({ status: "success", data, isError: false }),
        };
      } catch (error) {
        return {
          toDTO: () => ({
            status: "error",
            error: { message: error.message, status: error.status ?? 500, stack: "private" },
            isError: true,
          }),
        };
      }
    },
  };
}

async function loadSchemas() {
  return evaluateTypeScript(
    await readSource("src/shared/actions/coloring-collections/coloring-collections.schemas.ts"),
    { zod: { z } },
  );
}

async function loadActions() {
  const schemas = await loadSchemas();

  return evaluateTypeScript(
    await readSource("src/shared/actions/coloring-collections/coloring-collections.actions.ts"),
    {
      "@/shared/lib/api-result": { ApiResult: createApiResultMock() },
      "./coloring-collections.schemas": schemas,
    },
  );
}

test("digital collection actions validate exact public responses and use direct no-store URLs", async () => {
  const actions = await loadActions();
  const schemas = await loadSchemas();
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (...request) => {
    requests.push(request);
    return Response.json(requests.length === 1 ? [summary] : collection);
  };

  try {
    const list = await actions.getPublicColoringCollections();
    const detail = await actions.getPublicColoringCollection("forest / ?");

    assert.equal(list.status, "success");
    assert.deepEqual(list.data, [summary]);
    assert.equal(detail.status, "success");
    assert.deepEqual(detail.data, collection);
    assert.deepEqual(requests, [
      ["http://localhost:3002/coloring-collections", { cache: "no-store" }],
      ["http://localhost:3002/coloring-collections/forest%20%2F%20%3F", { cache: "no-store" }],
    ]);
    assert.equal(
      schemas.publicColoringCollectionSchema.safeParse({ ...collection, storageKey: "private" })
        .success,
      false,
    );
    assert.equal(
      schemas.publicColoringCollectionSchema.safeParse({
        ...collection,
        colorings: [
          { ...collection.colorings[0], card: { ...collection.colorings[0].card, checksum: "x" } },
        ],
      }).success,
      false,
    );
    assert.equal(
      schemas.publicColoringCollectionSchema.safeParse({
        ...collection,
        colorings: [{ ...collection.colorings[0], number: 0 }],
      }).success,
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("digital collection entity queries have stable hydrated list and slug identities", async () => {
  const { coloringCollectionsQuery } = evaluateTypeScript(
    await readSource("src/entities/coloring-collection/model/query.ts"),
    {
      "@tanstack/react-query": { queryOptions: (options) => options },
      "@/shared/actions/coloring-collections": {
        getPublicColoringCollections: async () => ({ data: [summary] }),
        getPublicColoringCollection: async () => ({ data: collection }),
      },
      "@/shared/lib/api-result": {
        ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
      },
    },
  );
  const list = coloringCollectionsQuery.getList();
  const detail = coloringCollectionsQuery.getDetail("forest");

  assert.deepEqual(list.queryKey, ["coloring-collections", "list"]);
  assert.deepEqual(detail.queryKey, ["coloring-collections", "detail", "forest"]);
  assert.equal(list.staleTime, Infinity);
  assert.equal(detail.retryOnMount, false);
  assert.deepEqual(await list.queryFn(), [summary]);
  assert.deepEqual(await detail.queryFn(), collection);
});

test("digital version routes use SSR builders, hydration, metadata, notFound, and structured data", async () => {
  const [hub, collection, coloring, collectionBuilder, coloringBuilder, routes] = await Promise.all([
    readSource("app/(site)/raskraski/page.tsx"),
    readSource("app/(site)/raskraski/digital/[collectionSlug]/page.tsx"),
    readSource("app/(site)/raskraski/digital/[collectionSlug]/[number]/page.tsx"),
    readSource("src/_app/lib/coloring-collections-data-builder.ts"),
    readSource("src/_app/lib/coloring-data-builder.ts"),
    readSource("src/shared/constants/routes.ts"),
  ]);

  assert.match(routes, /colorings:\s*"\/raskraski"/);
  assert.match(
    routes,
    /coloringCollection:\s*\(slug: string\) => `\/raskraski\/digital\/\$\{slug\}`/,
  );
  assert.match(routes, /coloring:\s*\(collectionSlug: string, number: number\)/);
  assert.match(hub, /withCollections\(\)/);
  assert.doesNotMatch(hub, /withProducts\(\)/);
  assert.match(hub, /ColoringCollectionsStructuredData/);
  assert.match(hub, /HydrationBoundary state=\{dehydrateQueryClient\(queryClient\)\}/);
  assert.equal((collection.match(/withCollection\(collectionSlug\)/g) ?? []).length, 2);
  assert.doesNotMatch(collection, /withProducts\(\)/);
  assert.match(collection, /createColoringCollectionMetadata\(collection\)/);
  assert.match(collection, /if \(collection === null\) \{\s*notFound\(\);\s*\}/);
  assert.match(collection, /ColoringCollectionStructuredData/);
  assert.match(collection, /HydrationBoundary state=\{dehydrateQueryClient\(queryClient\)\}/);
  assert.match(coloring, /withProducts\(\)/);
  assert.match(coloring, /HydrationBoundary state=\{dehydrateQueryClient\(queryClient\)\}/);
  assert.doesNotMatch(collectionBuilder, /productsQuery|ProductsDataResult|getProductsData|withProducts/);
  assert.match(coloringBuilder, /productsQuery\.getData\(\)\.queryKey/);
  assert.match(coloringBuilder, /await getProductsData\(\)/);
  assert.match(coloringBuilder, /withProducts\(\)/);
});

test("digital product references cannot carry price or stock in site schemas, types, actions, or API DTOs", async () => {
  const [collectionSchema, coloringSchema, collectionTypes, coloringTypes, collectionAction, coloringAction, apiDto] =
    await Promise.all([
      readSource("src/shared/actions/coloring-collections/coloring-collections.schemas.ts"),
      readSource("src/shared/actions/colorings/colorings.schemas.ts"),
      readSource("src/shared/actions/coloring-collections/coloring-collections.types.ts"),
      readSource("src/shared/actions/colorings/colorings.types.ts"),
      readSource("src/shared/actions/coloring-collections/coloring-collections.actions.ts"),
      readSource("src/shared/actions/colorings/colorings.actions.ts"),
      readSource("../api/src/colorings/dto/public-coloring.dto.ts"),
    ]);

  for (const source of [
    collectionSchema,
    coloringSchema,
    collectionTypes,
    coloringTypes,
    collectionAction,
    coloringAction,
    apiDto.match(/export class PublicColoringProductDTO[\s\S]*?^}/m)?.[0] ?? "",
  ]) {
    assert.doesNotMatch(source, /\bprice\b|\bisOutOfStock\b/);
  }

  const schemas = await loadSchemas();
  assert.equal(
    schemas.publicColoringCollectionSummarySchema.safeParse({
      ...summary,
      product: { ...summary.product, price: 1_000 },
    }).success,
    false,
  );
  assert.equal(
    schemas.publicColoringCollectionSummarySchema.safeParse({
      ...summary,
      product: { ...summary.product, isOutOfStock: false },
    }).success,
    false,
  );
});

test("digital catalog UI keeps covers clean, uses light card derivatives, and has no commerce data", async () => {
  const [catalog, gallery, productCard, purchasePanel, products, header] = await Promise.all([
    readSource("src/features/coloring-collections-catalog/ui/catalog.tsx"),
    readSource("src/features/coloring-collection-gallery/ui/gallery.tsx"),
    readSource("src/entities/products/ui/product-card.tsx"),
    readSource("src/features/product-purchase/ui/purchase-panel.tsx"),
    readSource("src/shared/actions/products/products.actions.ts"),
    readSource("src/widgets/header/ui/menu.tsx"),
  ]);

  assert.match(catalog, /aria-label=\{`Открыть тематику «\$\{collection\.title\}»`\}/);
  assert.match(catalog, /src=\{collection\.cover\.url\}/);
  assert.match(catalog, /\bunoptimized\b/);
  assert.match(catalog, /transition-shadow/);
  assert.match(catalog, /hover:shadow-lg/);
  assert.doesNotMatch(catalog, /hover:-translate-y/);
  assert.doesNotMatch(catalog, /CardTitle|CardDescription|collection\.description/);
  assert.doesNotMatch(catalog, /productAction|price|isOutOfStock|В корзину/);
  assert.match(
    gallery,
    /<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">/,
  );
  assert.doesNotMatch(gallery, /xl:grid-cols-5|sizes=/);
  assert.match(gallery, /src=\{coloring\.card\.url\}/);
  assert.match(gallery, /\bunoptimized\b/);
  assert.match(gallery, /group-hover:shadow-md/);
  assert.match(gallery, /group-hover:scale-\[1\.02\]/);
  assert.doesNotMatch(gallery, /group-hover:-translate-y/);
  assert.match(gallery, /const displayNumber = coloring\.number/);
  assert.match(gallery, /\{displayNumber\}/);
  assert.match(gallery, /routes\.coloring\(collection\.slug, displayNumber\)/);
  assert.doesNotMatch(gallery, /displayPosition|index \+ 1/);
  assert.doesNotMatch(gallery, /productAction|price|isOutOfStock|В корзину/);
  assert.doesNotMatch(productCard, /Смотреть цифровую версию/);
  assert.match(purchasePanel, /Смотреть цифровую версию/);
  assert.match(purchasePanel, /routes\.digitalCollection\(product\.digitalCollection\.slug\)/);
  assert.match(products, /digitalCollection: product\.digitalCollection/);
  assert.match(header, /title: "Цифровые версии"/);
});

test("digital collection hero shows album presentation, exact instruction, and then the gallery", async () => {
  const [gallery, workshopAction] = await Promise.all([
    readSource("src/features/coloring-collection-gallery/ui/gallery.tsx"),
    readSource("src/features/add-workshop-collection/ui/add-button.tsx"),
  ]);
  const hero = gallery.match(
    /<section className="container space-y-5 py-5 md:space-y-6 md:py-6">[\s\S]*?<\/section>/,
  )?.[0];

  assert.ok(hero);
  assert.match(gallery, /getDigitalCollectionPresentation\(collection\)/);
  assert.match(
    hero,
    /<PageTitle>\{presentation\.heading\}<\/PageTitle>[\s\S]*?\{collection\.coloringCount\} картин[\s\S]*?<SectionSubtitle>\{presentation\.instruction\}<\/SectionSubtitle>/,
  );
  assert.doesNotMatch(hero, /collection\.description|ExpandableText|Показать полностью/);
  assert.match(hero, /<PageTitle>[\s\S]*?\{workshopAction\}[\s\S]*?<SectionSubtitle>/);
  assert.match(workshopAction, /size="sm"/);
  assert.match(workshopAction, /variant="outline"/);
  assert.doesNotMatch(workshopAction, /\bw-full\b/);
  assert.ok(gallery.indexOf(hero) < gallery.indexOf("<ul className="));
  assert.match(gallery, /<CardTitle[\s\S]*?>\s*\{coloring\.title\}\s*<\/CardTitle>/);
});

test("digital collection presentation extracts a quoted album title with a safe fallback", async () => {
  const { getDigitalCollectionPresentation } = evaluateTypeScript(
    await readSource("src/features/coloring-collection-gallery/lib/presentation.ts"),
  );

  assert.deepEqual(
    getDigitalCollectionPresentation({
      title: "Цифровые картины",
      product: { title: "Раскраска по номерам «Котики 2»" },
    }),
    {
      albumTitle: "Котики 2",
      heading: "Котики 2 — цифровая версия",
      instruction:
        "Выберите картину из альбома «Котики 2», чтобы открыть цветной образец, контур и палитру с номерами маркеров Artmate.",
    },
  );
  assert.equal(
    getDigitalCollectionPresentation({
      title: "Загадочный лес",
      product: { title: "Альбом без кавычек" },
    }).albumTitle,
    "Загадочный лес",
  );
});

test("digital collection presentation extracts the quoted album title from the collection title", async () => {
  const { getDigitalCollectionPresentation } = evaluateTypeScript(
    await readSource("src/features/coloring-collection-gallery/lib/presentation.ts"),
  );

  assert.deepEqual(
    getDigitalCollectionPresentation({
      title: "Раскраска по номерам «Котики 2»: макеты и палитры Artmate",
      product: { title: "Раскраска по номерам Котики 2" },
    }),
    {
      albumTitle: "Котики 2",
      heading: "Котики 2 — цифровая версия",
      instruction:
        "Выберите картину из альбома «Котики 2», чтобы открыть цветной образец, контур и палитру с номерами маркеров Artmate.",
    },
  );
});
