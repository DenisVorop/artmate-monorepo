import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function loadTypeScript(path, mocks) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const testModule = { exports: {} };

  new Function("require", "module", "exports", outputText)(
    (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      throw new Error(`Unexpected test module import: ${specifier}`);
    },
    testModule,
    testModule.exports,
  );

  return { exports: testModule.exports, source };
}

test("shared CDEK city search uses debounced input and hides stale data and errors", async () => {
  let queryOptions;
  const staleCity = { code: 44, countryCode: "RU", name: "Москва" };
  const { exports, source } = await loadTypeScript(
    "src/features/checkout/model/use-cdek-cities.ts",
    {
      "@/shared/actions/delivery": { searchCdekCities: async () => ({ data: [] }) },
      "@/shared/lib/api-result": {
        ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
      },
      "@tanstack/react-query": {
        useQuery: (options) => {
          queryOptions = options;
          return {
            data: { cities: [staleCity], query: "Москва" },
            isError: true,
            isFetching: true,
            isPending: false,
            refetch: () => "retry",
          };
        },
      },
      "../lib/use-debounced-city-query": {
        useDebouncedCityQuery: () => "Москва",
      },
    },
  );

  const result = exports.useCdekCities("Санкт-Петербург");

  assert.doesNotMatch(source, /useState|setTimeout/u);
  assert.deepEqual(queryOptions.queryKey, ["delivery", "cdek", "cities", "Москва"]);
  assert.deepEqual(result.cities, []);
  assert.equal(result.isError, false);
  assert.equal(result.isFetching, false);
  assert.equal(result.isPending, true);
  assert.equal(result.retry(), "retry");
});

test("CDEK city details are exact-code scoped and reject late selected-city data", async () => {
  let queryOptions;
  let actionCalls = 0;
  const city = {
    code: 44,
    countryCode: "RU",
    latitude: 55.75,
    longitude: 37.61,
    name: "Москва",
    region: "Москва",
  };
  const { exports } = await loadTypeScript("src/features/checkout/model/use-cdek-city.ts", {
    "@/shared/actions/delivery": {
      getCdekCity: async () => {
        actionCalls += 1;
        return { data: city };
      },
    },
    "@/shared/lib/api-result": {
      ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
    },
    "@tanstack/react-query": {
      useQuery: (options) => {
        queryOptions = options;
        return {
          data: { city, cityCode: 44 },
          isError: false,
          isFetching: true,
          isPending: false,
          refetch: () => "retry",
        };
      },
    },
  });

  const lateResult = exports.useCdekCity(137, true);

  assert.deepEqual(queryOptions.queryKey, ["delivery", "cdek", "city", 137]);
  assert.equal(queryOptions.enabled, true);
  assert.equal(queryOptions.gcTime, 5 * 60_000);
  assert.equal(queryOptions.staleTime, 7 * 24 * 60 * 60_000);
  assert.equal(lateResult.city, undefined);
  assert.equal(lateResult.isFetching, true);
  assert.equal(lateResult.retry(), "retry");
  await assert.rejects(queryOptions.queryFn(), /координаты выбранного города/u);
  assert.equal(actionCalls, 1);

  const disabled = exports.useCdekCity(undefined, true);
  assert.equal(queryOptions.enabled, false);
  assert.equal(disabled.city, undefined);
  assert.equal(disabled.isPending, false);
  assert.equal(actionCalls, 1);
});

test("Ozon pickup query is city-gated and hides late wrong-city data and errors", async () => {
  let queryOptions;
  const stalePoint = {
    id: "old",
    address: "Old",
    title: "Old",
    workHours: "09:00",
    deliveryPrice: 100,
  };
  const { exports } = await loadTypeScript(
    "src/features/checkout/model/use-ozon-pickup-points.ts",
    {
      "@/shared/actions/delivery": {
        getOzonPickupPoints: async () => ({ data: [] }),
      },
      "@/shared/lib/api-result": {
        ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
      },
      "@tanstack/react-query": {
        useQuery: (options) => {
          queryOptions = options;
          return {
            data: { cityCode: 44, pickupPoints: [stalePoint] },
            isError: true,
            isFetching: true,
            isPending: false,
            refetch: () => "retry",
          };
        },
      },
    },
  );

  const late = exports.useOzonPickupPoints(137, true);
  assert.deepEqual(queryOptions.queryKey, ["delivery", "ozon", "pickup-points", 137]);
  assert.equal(queryOptions.enabled, true);
  assert.equal(queryOptions.staleTime, 45_000);
  assert.equal(queryOptions.gcTime, 5 * 60_000);
  assert.deepEqual(late.pickupPoints, []);
  assert.equal(late.isError, false);
  assert.equal(late.isPending, true);

  const disabled = exports.useOzonPickupPoints(137, false);
  assert.equal(queryOptions.enabled, false);
  assert.deepEqual(disabled.pickupPoints, []);
  assert.equal(disabled.isPending, false);
});

test("city debounce UI state lives in lib and cancels its 300ms timer", async () => {
  const previousWindow = globalThis.window;
  let timer;
  let cleanup;
  let applied;
  let cleared;
  globalThis.window = {
    setTimeout(callback, delay) {
      timer = { callback, delay };
      return 91;
    },
    clearTimeout(id) {
      cleared = id;
    },
  };
  try {
    const { exports } = await loadTypeScript(
      "src/features/checkout/lib/use-debounced-city-query.ts",
      {
        react: {
          useState: (initial) => [
            initial,
            (value) => {
              applied = value;
            },
          ],
          useEffect: (effect) => {
            cleanup = effect();
          },
        },
      },
    );
    assert.equal(exports.useDebouncedCityQuery(" Москва "), "Москва");
    assert.equal(timer.delay, 300);
    timer.callback();
    assert.equal(applied, "Москва");
    cleanup();
    assert.equal(cleared, 91);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
