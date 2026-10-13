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

const asset = (name) => ({
  url: `https://api.example.test/colorings/forest/01/${name}`,
  alt: name,
});
const original = {
  id: "original",
  label: "Оригинал",
  image: asset("original"),
  outline: asset("original-outline"),
  card: { ...asset("original-card"), width: 300, height: 400 },
  colors: [{ symbolPosition: 1, symbol: "1", hex: "#D7E4DD" }],
};
const variant = {
  id: "artmate",
  label: "Artmate 168",
  kind: "MARKER",
  totalColors: 168,
  image: asset("artmate"),
  outline: asset("artmate-outline"),
  card: { ...asset("artmate-card"), width: 300, height: 400 },
  colors: [{ symbolPosition: 1, symbol: "1", hex: "#D6E0DC", code: "001" }],
};
const coloring = {
  id: "coloring-1",
  number: 1,
  title: "Лиса и сова",
  description: "Лесные герои",
  token: "publication-2",
  defaultPaletteId: "artmate",
  publishedAt: "2026-09-27T10:00:00.000Z",
  themes: [],
  width: 1200,
  height: 1600,
  original,
  variants: [variant],
  collection: {
    id: "collection-1",
    slug: "forest",
    title: "Лес",
    product: { id: "album-1", slug: "forest-album", title: "Лесной альбом" },
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
  return evaluateTypeScript(
    await readSource("src/shared/actions/coloring-variants/coloring-variants.schemas.ts"),
    {
      zod: { z },
    },
  );
}

async function loadActions() {
  const schemas = await loadSchemas();

  return evaluateTypeScript(
    await readSource("src/shared/actions/coloring-variants/coloring-variants.actions.ts"),
    {
      "@/shared/constants": {
        formatColoringNumber: (number) => String(number).padStart(2, "0"),
      },
      "@/shared/lib/api-result": { ApiResult: createApiResultMock() },
      "./coloring-variants.schemas": schemas,
    },
  );
}

test("variants schema accepts published palettes and rejects old or invalid contracts", async () => {
  const { publicColoringVariantsSchema: schema } = await loadSchemas();
  assert.deepEqual(schema.parse(coloring), coloring);
  assert.equal(schema.parse(coloring).variants[0].colors[0].code, "001");
  assert.equal(
    schema.safeParse({ ...coloring, variants: [], defaultPaletteId: "original" }).success,
    true,
  );
  for (const invalid of [
    { ...coloring, publishedRevisionId: "old" },
    { ...coloring, outline: asset("old-shared-outline") },
    { ...coloring, original: { ...original, outline: undefined } },
    { ...coloring, variants: [{ ...variant, outline: undefined }] },
    { ...coloring, width: 4097 },
    {
      ...coloring,
      original: { ...original, colors: [{ symbolPosition: 20, symbol: "K", hex: "#D7E4DD" }] },
    },
    { ...coloring, variants: [{ ...variant, kind: "INK" }] },
    { ...coloring, variants: [{ ...variant, image: { ...variant.image, storageKey: "private" } }] },
  ])
    assert.equal(schema.safeParse(invalid).success, false);
});

test("action requests only variants with canonical route and no-store; errors remain classified", async () => {
  const actions = await loadActions();
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (...request) => {
    requests.push(request);
    return Response.json(coloring);
  };
  try {
    const result = await actions.getPublicColoringVariants("forest/owl ?", 1);
    assert.deepEqual(result.data, coloring);
    assert.equal(requests[0][0], "http://localhost:3002/colorings/forest%2Fowl%20%3F/01/variants");
    assert.deepEqual(requests[0][1], { cache: "no-store" });
    for (const status of [404, 500, 503]) {
      globalThis.fetch = async () => new Response("failure", { status });
      const error = await actions.getPublicColoringVariants("forest", 1);
      assert.equal(error.error.status, status);
      assert.equal(Object.hasOwn(error.error, "stack"), false);
    }
    globalThis.fetch = async () => Response.json({ ...coloring, privateStorageKey: "private" });
    assert.equal((await actions.getPublicColoringVariants("forest", 1)).error.status, 502);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("coloring detail query identity includes the published revision and has static hydration options", async () => {
  const source = await readSource("src/entities/coloring-variants/model/query.ts");
  const { coloringVariantsQuery } = evaluateTypeScript(source, {
    "@/shared/actions/coloring-variants": {
      getPublicColoringVariants: async () => ({ data: coloring }),
    },
    "@/shared/lib/api-result": {
      ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
    },
    "@tanstack/react-query": { queryOptions: (options) => options },
  });
  const options = coloringVariantsQuery.getDetail("forest", 1, "publication-2");

  assert.deepEqual(options.queryKey, ["coloring-variants", "detail", "forest", 1, "publication-2"]);
  assert.equal(options.staleTime, Infinity);
  assert.equal(options.retryOnMount, false);
  assert.deepEqual(await options.queryFn(), coloring);
});

test("coloring detail query rejects a newer revision without poisoning the old revision cache", async () => {
  const source = await readSource("src/entities/coloring-variants/model/query.ts");
  const oldColoring = { ...coloring, token: "publication-1" };
  const { coloringVariantsQuery } = evaluateTypeScript(source, {
    "@/shared/actions/coloring-variants": {
      getPublicColoringVariants: async () => ({ data: coloring }),
    },
    "@/shared/lib/api-result": {
      ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
    },
    "@tanstack/react-query": { queryOptions },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const options = coloringVariantsQuery.getDetail("forest", 1, "publication-1");

  queryClient.setQueryData(options.queryKey, oldColoring);
  await queryClient.invalidateQueries({ queryKey: options.queryKey });

  await assert.rejects(
    () => queryClient.fetchQuery(options),
    (error) =>
      error.message ===
      'Coloring publication mismatch for "forest/1": expected "publication-1", received "publication-2"',
  );
  assert.deepEqual(queryClient.getQueryData(options.queryKey), oldColoring);

  queryClient.clear();
});

test("coloring detail query rejects a response for another canonical route", async () => {
  const source = await readSource("src/entities/coloring-variants/model/query.ts");
  const mismatchedColoring = { ...coloring, number: 2 };
  const { coloringVariantsQuery } = evaluateTypeScript(source, {
    "@/shared/actions/coloring-variants": {
      getPublicColoringVariants: async () => ({ data: mismatchedColoring }),
    },
    "@/shared/lib/api-result": {
      ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
    },
    "@tanstack/react-query": { queryOptions: (options) => options },
  });

  await assert.rejects(
    () => coloringVariantsQuery.getDetail("forest", 1, "publication-2").queryFn(),
    /Coloring route mismatch: expected "forest\/1", received "forest\/2"/,
  );
});

test("coloring hook exposes bounded query state including refetch", async () => {
  const source = await readSource(
    "src/entities/coloring-variants/model/use-coloring-variants-data.ts",
  );
  const refetch = () => undefined;
  const { useColoringVariantsData } = evaluateTypeScript(source, {
    "./query": { coloringVariantsQuery: { getDetail: () => ({}) } },
    "@tanstack/react-query": {
      useQuery: () => ({ data: coloring, error: null, isError: false, isPending: false, refetch }),
    },
  });

  assert.deepEqual(useColoringVariantsData("forest", 1, "publication-2"), {
    coloring,
    error: null,
    isError: false,
    isPending: false,
    refetch,
  });
});

test("ColoringVariantsDataBuilder fetches once, separates 404, throws 5xx, and hydrates the final key", async () => {
  const source = await readSource("src/_app/lib/coloring-variants-data-builder.ts");
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
  const { ColoringVariantsDataBuilder } = evaluateTypeScript(source, {
    "@/entities/coloring-variants": {
      coloringVariantsQuery: {
        getDetail: (collectionSlug, number, revisionId) => ({
          queryKey: ["coloring-variants", "detail", collectionSlug, number, revisionId],
        }),
      },
    },
    "@/entities/products": {
      productsQuery: { getData: () => ({ queryKey: ["products", "data"] }) },
    },
    "@/shared/actions/coloring-variants": {
      getPublicColoringVariants: async () => {
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
  const success = await new ColoringVariantsDataBuilder().withColoringVariants("forest", 1).build();

  assert.equal(fetches, 1);
  assert.deepEqual(success.coloring, coloring);
  assert.deepEqual(cacheWrites, [
    {
      queryKey: ["coloring-variants", "detail", "forest", 1, "publication-2"],
      data: coloring,
    },
  ]);

  responses.push({ status: "error", error: { message: "missing", status: 404 } });
  const missing = await new ColoringVariantsDataBuilder()
    .withColoringVariants("missing", 1)
    .build();
  assert.equal(missing.coloring, null);

  responses.push({ status: "error", error: { message: "unavailable", status: 503 } });
  await assert.rejects(
    () => new ColoringVariantsDataBuilder().withColoringVariants("broken", 1).build(),
    (error) => error.status === 503,
  );
  assert.equal(fetches, 3);

  responses.push({ status: "success", data: coloring });
  const detail = await new ColoringVariantsDataBuilder()
    .withColoringVariants("forest", 1)
    .withProducts()
    .build();
  assert.deepEqual(detail.productsData, { products: [] });
  assert.equal(productFetches, 1);
  assert.deepEqual(
    cacheWrites.find(({ queryKey }) => queryKey[0] === "products"),
    { queryKey: ["products", "data"], data: { products: [] } },
  );
});
