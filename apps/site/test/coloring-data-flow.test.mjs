import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { QueryClient, queryOptions } = require("@tanstack/react-query");
const { z } = require("zod");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, mocks, appendedSource = "") {
  const output = ts.transpileModule(`${source}\n${appendedSource}`, {
    compilerOptions: {
      esModuleInterop: true,
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

const coloring = {
  id: "coloring-1",
  number: 1,
  title: "Лиса и сова",
  description: "Раскраска с лесными героями",
  publishedRevisionId: "revision-2",
  publishedAt: "2026-08-29T10:00:00.000Z",
  firstPublishedAt: "2026-08-28T10:00:00.000Z",
  themes: [{ id: "theme-1", slug: "forest", title: "Лес" }],
  collection: {
    id: "collection-1",
    slug: "forest",
    title: "Загадочный лес",
    product: {
      id: "product-1",
      slug: "forest-album",
      title: "Лесной альбом",
      category: { id: "category-1", slug: "albums", title: "Альбомы" },
    },
  },
  palette: {
    label: "Artmate",
    version: "2026.1",
    usedColorCount: 2,
    colors: [
      {
        symbolPosition: 1,
        symbol: "1",
        colorNumber: 27,
        pantone: "5595C",
        hex: "#D7E4DD",
        markerNumber: "173",
      },
      {
        symbolPosition: 19,
        symbol: "J",
        colorNumber: 241,
        pantone: "7621C",
        hex: "#A6192E",
        markerNumber: "023",
      },
    ],
  },
  width: 1200,
  height: 1600,
  outline: {
    url: "https://api.example.test/colorings/forest/01/assets/revision-2/outline/content",
    alt: "Контур лисы и совы",
  },
  colored: {
    url: "https://api.example.test/colorings/forest/01/assets/revision-2/colored/content",
    alt: "Лиса и сова в цвете",
  },
};

function createApiResultMock() {
  return {
    prepareApi: (callback) => async () => {
      try {
        const data = await callback();

        return {
          toDTO: () => ({
            status: "success",
            data,
            isSuccess: true,
            isEmpty: false,
            isError: false,
          }),
        };
      } catch (error) {
        return {
          toDTO: () => ({
            status: "error",
            error: {
              message: error.message,
              name: "ApiError",
              stack: error.stack ?? "internal server stack",
              status: error.status ?? 500,
            },
            isSuccess: false,
            isEmpty: false,
            isError: true,
          }),
        };
      }
    },
  };
}

async function loadSchemas() {
  return evaluateTypeScript(await readSource("src/shared/actions/colorings/colorings.schemas.ts"), {
    zod: { z },
  });
}

async function loadActions() {
  const schemas = await loadSchemas();

  return evaluateTypeScript(await readSource("src/shared/actions/colorings/colorings.actions.ts"), {
    "@/shared/constants": {
      formatColoringNumber: (number) => String(number).padStart(2, "0"),
    },
    "@/shared/lib/api-result": { ApiResult: createApiResultMock() },
    "./colorings.schemas": schemas,
  });
}

test("coloring route helpers enforce canonical two-digit numbers", async () => {
  const { formatColoringNumber, parseColoringNumber, routes } = evaluateTypeScript(
    await readSource("src/shared/constants/routes.ts"),
    {},
  );

  assert.equal(formatColoringNumber(1), "01");
  assert.equal(formatColoringNumber(9), "09");
  assert.equal(formatColoringNumber(10), "10");
  assert.equal(formatColoringNumber(99), "99");
  assert.equal(routes.coloring("forest", 1), "/raskraski/digital/forest/01");
  assert.equal(parseColoringNumber("01"), 1);
  assert.equal(parseColoringNumber("99"), 99);

  for (const value of ["00", "1", "001", "100", "-1", "1a"]) {
    assert.equal(parseColoringNumber(value), null);
  }

  for (const value of [0, 100, 1.5]) {
    assert.throws(() => formatColoringNumber(value), RangeError);
  }
});

test("coloring actions use no-store, canonical numbers, and exact response validation", async () => {
  const actions = await loadActions();
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (...request) => {
    requests.push(request);
    return new Response(JSON.stringify(coloring), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await actions.getPublicColoring("forest/owl ?", 1);

    assert.equal(result.status, "success");
    assert.deepEqual(result.data, coloring);
    assert.equal(requests[0][0], "http://localhost:3002/colorings/forest%2Fowl%20%3F/01");
    assert.deepEqual(requests[0][1], { cache: "no-store" });

    globalThis.fetch = async (...request) => {
      requests.push(request);
      return new Response(
        JSON.stringify([
          { collectionSlug: "forest", number: 1, lastModified: coloring.publishedAt },
        ]),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    };

    const manifest = await actions.getPublicColoringsManifest();

    assert.equal(manifest.status, "success");
    assert.deepEqual(manifest.data, [
      { collectionSlug: "forest", number: 1, lastModified: coloring.publishedAt },
    ]);
    assert.equal(requests[1][0], "http://localhost:3002/colorings");
    assert.deepEqual(requests[1][1], { cache: "no-store" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("coloring schemas accept native-resolution artwork and enforce the 4096px bound", async () => {
  const { publicColoringSchema } = await loadSchemas();

  for (const [width, height] of [
    [2450, 3436],
    [4096, 4096],
    [1, 1],
  ]) {
    assert.equal(publicColoringSchema.safeParse({ ...coloring, width, height }).success, true);
  }

  for (const [width, height] of [
    [4097, 3436],
    [2450, 4097],
    [0, 1600],
    [1200, 0],
    [1200.5, 1600],
  ]) {
    assert.equal(publicColoringSchema.safeParse({ ...coloring, width, height }).success, false);
  }
});

test("strict coloring schemas reject unknown nested and top-level fields", async () => {
  const { publicColoringSchema, publicColoringsManifestSchema } = await loadSchemas();

  assert.equal(
    publicColoringSchema.safeParse({ ...coloring, privateStorageKey: "secret" }).success,
    false,
  );
  assert.equal(
    publicColoringSchema.safeParse({
      ...coloring,
      outline: { ...coloring.outline, checksum: "secret" },
    }).success,
    false,
  );
  assert.equal(
    publicColoringSchema.safeParse({
      ...coloring,
      palette: {
        ...coloring.palette,
        colors: [{ ...coloring.palette.colors[0], symbolPosition: 20 }],
      },
    }).success,
    false,
  );
  assert.equal(
    publicColoringSchema.safeParse({
      ...coloring,
      palette: {
        ...coloring.palette,
        colors: [{ ...coloring.palette.colors[0], symbolPosition: 19, symbol: "K" }],
      },
    }).success,
    false,
  );
  assert.equal(
    publicColoringSchema.safeParse({
      ...coloring,
      palette: {
        ...coloring.palette,
        colors: Array.from({ length: 20 }, (_, index) => ({
          ...coloring.palette.colors[0],
          symbolPosition: Math.min(index + 1, 19),
          symbol: index < 9 ? String(index + 1) : String.fromCharCode(56 + index),
        })),
      },
    }).success,
    false,
  );
  assert.equal(
    publicColoringSchema.safeParse({
      ...coloring,
      collection: { ...coloring.collection, productId: "secret" },
    }).success,
    false,
  );
  for (const commerceField of [
    { price: 1_000 },
    { isOutOfStock: false },
  ]) {
    assert.equal(
      publicColoringSchema.safeParse({
        ...coloring,
        collection: {
          ...coloring.collection,
          product: { ...coloring.collection.product, ...commerceField },
        },
      }).success,
      false,
    );
  }
  assert.equal(
    publicColoringsManifestSchema.safeParse([
      {
        collectionSlug: "forest",
        number: 1,
        lastModified: coloring.publishedAt,
        id: "secret",
      },
    ]).success,
    false,
  );
  assert.equal(publicColoringSchema.safeParse({ ...coloring, number: 0 }).success, false);
  assert.equal(publicColoringSchema.safeParse({ ...coloring, number: 100 }).success, false);
  assert.equal(
    publicColoringSchema.safeParse({
      ...coloring,
      palette: {
        ...coloring.palette,
        colors: [{ ...coloring.palette.colors[0], symbol: "10" }],
      },
    }).success,
    false,
  );
  assert.equal(
    publicColoringSchema.safeParse({
      ...coloring,
      palette: { ...coloring.palette, colors: [] },
    }).success,
    true,
  );
});

test("coloring actions preserve status classification without serializing internal stacks", async () => {
  const actions = await loadActions();
  const originalFetch = globalThis.fetch;

  const assertSafeError = (result, status) => {
    assert.equal(result.status, "error");
    assert.equal(result.error.status, status);
    assert.equal(Object.hasOwn(result.error, "stack"), false);
  };

  try {
    for (const status of [404, 500, 503]) {
      globalThis.fetch = async () => new Response("failure", { status });
      const result = await actions.getPublicColoring("missing", 1);

      assertSafeError(result, status);
    }

    globalThis.fetch = async () => new Response("not-json", { status: 200 });
    assertSafeError(await actions.getPublicColoring("broken", 1), 502);

    globalThis.fetch = async () => Response.json({ ...coloring, checksum: "secret" });
    assertSafeError(await actions.getPublicColoring("broken", 1), 502);

    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    assertSafeError(await actions.getPublicColoring("offline", 1), 500);

    globalThis.fetch = async () => new Response("failure", { status: 503 });
    assertSafeError(await actions.getPublicColoringsManifest(), 503);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("coloring detail query identity includes the published revision and has static hydration options", async () => {
  const source = await readSource("src/entities/coloring/model/query.ts");
  const { coloringQuery } = evaluateTypeScript(source, {
    "@/shared/actions/colorings": { getPublicColoring: async () => ({ data: coloring }) },
    "@/shared/lib/api-result": {
      ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
    },
    "@tanstack/react-query": { queryOptions: (options) => options },
  });
  const options = coloringQuery.getDetail("forest", 1, "revision-2");

  assert.deepEqual(options.queryKey, ["coloring", "detail", "forest", 1, "revision-2"]);
  assert.equal(options.staleTime, Infinity);
  assert.equal(options.retryOnMount, false);
  assert.deepEqual(await options.queryFn(), coloring);
});

test("coloring detail query rejects a newer revision without poisoning the old revision cache", async () => {
  const source = await readSource("src/entities/coloring/model/query.ts");
  const oldColoring = { ...coloring, publishedRevisionId: "revision-1" };
  const { coloringQuery } = evaluateTypeScript(source, {
    "@/shared/actions/colorings": {
      getPublicColoring: async () => ({ data: coloring }),
    },
    "@/shared/lib/api-result": {
      ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
    },
    "@tanstack/react-query": { queryOptions },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const options = coloringQuery.getDetail("forest", 1, "revision-1");

  queryClient.setQueryData(options.queryKey, oldColoring);
  await queryClient.invalidateQueries({ queryKey: options.queryKey });

  await assert.rejects(
    () => queryClient.fetchQuery(options),
    (error) =>
      error.message ===
      'Coloring revision mismatch for "forest/1": expected "revision-1", received "revision-2"',
  );
  assert.deepEqual(queryClient.getQueryData(options.queryKey), oldColoring);

  queryClient.clear();
});

test("coloring detail query rejects a response for another canonical route", async () => {
  const source = await readSource("src/entities/coloring/model/query.ts");
  const mismatchedColoring = { ...coloring, number: 2 };
  const { coloringQuery } = evaluateTypeScript(source, {
    "@/shared/actions/colorings": {
      getPublicColoring: async () => ({ data: mismatchedColoring }),
    },
    "@/shared/lib/api-result": {
      ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
    },
    "@tanstack/react-query": { queryOptions: (options) => options },
  });

  await assert.rejects(
    () => coloringQuery.getDetail("forest", 1, "revision-2").queryFn(),
    /Coloring route mismatch: expected "forest\/1", received "forest\/2"/,
  );
});

test("coloring hook exposes bounded query state including refetch", async () => {
  const source = await readSource("src/entities/coloring/model/use-coloring-data.ts");
  const refetch = () => undefined;
  const { useColoringData } = evaluateTypeScript(source, {
    "./query": { coloringQuery: { getDetail: () => ({}) } },
    "@tanstack/react-query": {
      useQuery: () => ({ data: coloring, error: null, isError: false, isPending: false, refetch }),
    },
  });

  assert.deepEqual(useColoringData("forest", 1, "revision-2"), {
    coloring,
    error: null,
    isError: false,
    isPending: false,
    refetch,
  });
});

test("ColoringDataBuilder fetches once, separates 404, throws 5xx, and hydrates the final key", async () => {
  const source = await readSource("src/_app/lib/coloring-data-builder.ts");
  const responses = [];
  const cacheWrites = [];
  let fetches = 0;
  let productFetches = 0;
  class BaseDataBuilder {
    constructor(childClass = this.constructor, tasks = {}, queryClient) {
      this.childClass = childClass;
      this.tasks = tasks;
      this.queryClient = queryClient ?? {
        setQueryData: (queryKey, data) => cacheWrites.push({ data, queryKey }),
      };
    }

    add(key, task) {
      return new this.childClass(this.childClass, { ...this.tasks, [key]: task }, this.queryClient);
    }

    setApiResultQueryData(queryKey, result) {
      const data = result.data ?? null;
      this.queryClient.setQueryData(queryKey, data);
      return data;
    }

    async build() {
      const entries = await Promise.all(
        Object.entries(this.tasks).map(async ([key, task]) => [key, await task()]),
      );

      return { ...Object.fromEntries(entries), queryClient: this.queryClient };
    }
  }
  const ApiResult = {
    fromDTO: (result) => ({
      data: result.data,
      error: result.error
        ? Object.assign(new Error(result.error.message), result.error)
        : undefined,
      isError: result.status === "error",
    }),
  };
  const { ColoringDataBuilder } = evaluateTypeScript(source, {
    "@/entities/coloring": {
      coloringQuery: {
        getDetail: (collectionSlug, number, revisionId) => ({
          queryKey: ["coloring", "detail", collectionSlug, number, revisionId],
        }),
      },
    },
    "@/entities/products": {
      productsQuery: { getData: () => ({ queryKey: ["products", "data"] }) },
    },
    "@/shared/actions/colorings": {
      getPublicColoring: async () => {
        fetches += 1;
        return responses.shift();
      },
    },
    "@/shared/actions/products": {
      getProductsData: async () => {
        productFetches += 1;
        return { status: "success", data: { products: [] } };
      },
    },
    "@/shared/lib/api-result": { ApiResult },
    "./base-data-builder": { BaseDataBuilder },
  });

  responses.push({ status: "success", data: coloring });
  const success = await new ColoringDataBuilder().withColoring("forest", 1).build();

  assert.equal(fetches, 1);
  assert.deepEqual(success.coloring, coloring);
  assert.deepEqual(cacheWrites, [
    {
      queryKey: ["coloring", "detail", "forest", 1, "revision-2"],
      data: coloring,
    },
  ]);

  responses.push({ status: "error", error: { message: "missing", status: 404 } });
  const missing = await new ColoringDataBuilder().withColoring("missing", 1).build();
  assert.equal(missing.coloring, null);

  responses.push({ status: "error", error: { message: "unavailable", status: 503 } });
  await assert.rejects(
    () => new ColoringDataBuilder().withColoring("broken", 1).build(),
    (error) => error.status === 503,
  );
  assert.equal(fetches, 3);

  responses.push({ status: "success", data: coloring });
  const detail = await new ColoringDataBuilder()
    .withColoring("forest", 1)
    .withProducts()
    .build();
  assert.deepEqual(detail.productsData, { products: [] });
  assert.equal(productFetches, 1);
  assert.deepEqual(
    cacheWrites.find(({ queryKey }) => queryKey[0] === "products"),
    { queryKey: ["products", "data"], data: { products: [] } },
  );
});
