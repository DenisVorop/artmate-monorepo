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

  return testModule.exports;
}

async function loadQueryHook(file, queryResult) {
  const queries = [];
  const exports = await loadTypeScript(`src/features/checkout/model/${file}.ts`, {
    "@/shared/actions/delivery": {},
    "@/shared/lib/api-result": {},
    "@tanstack/react-query": {
      useQuery: (options) => {
        queries.push(options);
        return queryResult;
      },
    },
  });

  return { ...exports, queries };
}

const cachedCity = { countryCode: "RU", id: "moscow", name: "Москва", region: "Москва" };
const cachedPoint = {
  address: "Москва, ул. Лесная, 12",
  deliveryPrice: 100,
  id: "point-81",
  latitude: 55.78,
  longitude: 37.59,
  title: "Пункт выдачи Ozon",
  workHours: "09:00–21:00",
};
const idleQuery = {
  data: undefined,
  isError: false,
  isFetching: false,
  isPending: false,
  refetch: () => undefined,
};

async function renderSelector({ cityQuery, settledQuery, cityResult, pointResult = idleQuery }) {
  const cities = await loadQueryHook("use-ozon-cities", cityResult);
  const points = await loadQueryHook("use-ozon-pickup-points", pointResult);
  const jsx = (type, props, key) => ({ key, props, type });
  const states = [cityQuery, "", true, false];
  let stateIndex = 0;
  const { DeliverySelector } = await loadTypeScript(
    "src/features/checkout/ui/delivery-selector/delivery-selector.tsx",
    {
      "../../lib": {
        filterPickupPoints: (items) => items,
        formatPickupPointCount: (count) => `${count} ПВЗ`,
        useDebouncedCityQuery: () => settledQuery,
      },
      "../../model": {
        useCdekCities: () => ({ cities: [], ...idleQuery }),
        useCdekPickupPoints: () => ({ pickupPoints: [], ...idleQuery }),
        useOzonCities: cities.useOzonCities,
        useOzonPickupPoints: points.useOzonPickupPoints,
      },
      "./combobox-field": { ComboboxField: "ComboboxField" },
      "./combobox-option": { ComboboxOption: "ComboboxOption" },
      "./delivery-company-selector": { DeliveryCompanySelector: "DeliveryCompanySelector" },
      "./delivery-options": { defaultDeliveryCompany: "cdek" },
      "./map-placeholder": { MapPlaceholder: "MapPlaceholder" },
      "./pickup-points-map": { PickupPointsMap: "PickupPointsMap" },
      "@/shared/lib": { cn: (...classes) => classes.filter(Boolean).join(" ") },
      "@/shared/ui/button": { Button: "Button" },
      "lucide-react": {
        CheckCircle2: "CheckCircle2",
        CircleAlert: "CircleAlert",
        LoaderCircle: "LoaderCircle",
        MapPin: "MapPin",
      },
      react: {
        useEffect: () => undefined,
        useMemo: (factory) => factory(),
        useState: () => [states[stateIndex++], () => undefined],
      },
      "react/jsx-runtime": { jsx, jsxs: jsx },
    },
  );

  return {
    queries: cities.queries,
    tree: DeliverySelector({
      drafts: { cdek: {}, ozon: { city: cachedCity, localityId: cachedCity.id } },
      isOzonDeliveryAvailable: true,
      onCompanyChange: () => undefined,
      onDraftChange: () => undefined,
      selectedCompany: "ozon",
    }),
  };
}

function findNodes(node, predicate) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => findNodes(child, predicate));

  return [...(predicate(node) ? [node] : []), ...findNodes(node.props?.children, predicate)];
}

test("city debounce waits 300ms and cancels obsolete timers and unmounted updates", async () => {
  let now = 0;
  let nextTimerId = 0;
  let state;
  let initialized = false;
  let dependencies;
  let cleanup;
  const timers = new Map();
  const updates = [];
  const clearedTimers = [];
  const originalWindow = globalThis.window;
  const { useDebouncedCityQuery } = await loadTypeScript(
    "src/features/checkout/lib/use-debounced-city-query.ts",
    {
      react: {
        useState: (initialValue) => {
          if (!initialized) {
            initialized = true;
            state = initialValue;
          }
          return [
            state,
            (value) => {
              state = value;
              updates.push(value);
            },
          ];
        },
        useEffect: (effect, nextDependencies) => {
          if (dependencies?.[0] === nextDependencies[0]) return;
          cleanup?.();
          dependencies = nextDependencies;
          cleanup = effect();
        },
      },
    },
  );

  globalThis.window = {
    setTimeout: (callback, delay) => {
      assert.equal(delay, 300);
      const id = ++nextTimerId;
      timers.set(id, { callback, due: now + delay });
      return id;
    },
    clearTimeout: (id) => {
      clearedTimers.push(id);
      timers.delete(id);
    },
  };

  const advance = (duration) => {
    now += duration;
    for (const [id, timer] of timers) {
      if (timer.due <= now) {
        timers.delete(id);
        timer.callback();
      }
    }
  };

  try {
    assert.equal(useDebouncedCityQuery("  Москва  "), "Москва");
    assert.equal(useDebouncedCityQuery("Каз"), "Москва");
    advance(299);
    assert.deepEqual(updates, []);
    assert.equal(useDebouncedCityQuery("  Казань  "), "Москва");
    advance(299);
    assert.deepEqual(updates, []);
    advance(1);
    assert.deepEqual(updates, ["Казань"]);
    assert.equal(useDebouncedCityQuery("Казань"), "Казань");
    assert.equal(timers.size, 0);

    useDebouncedCityQuery("Пермь");
    assert.equal(timers.size, 1);
    cleanup();
    advance(1_000);
    assert.equal(timers.size, 0);
    assert.deepEqual(updates, ["Казань"]);
    assert.deepEqual(clearedTimers, [1, 2, 3, 4]);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("unsettled city input hides previous cached results and errors until debounce settles", async () => {
  const staleResult = { ...idleQuery, data: [cachedCity], isError: true, isFetching: true };
  const { queries, tree } = await renderSelector({
    cityQuery: "Санкт",
    settledQuery: "Москва",
    cityResult: staleResult,
  });
  const [cityField] = findNodes(tree, (node) => node.props?.label === "Город");

  assert.equal(queries[0].enabled, false);
  assert.equal(cityField.props.isPending, true);
  assert.notEqual(cityField.props.emptyText, "Не удалось загрузить города");
  assert.deepEqual(
    findNodes(tree, (node) => node.type === "ComboboxOption"),
    [],
  );
  assert.deepEqual(
    findNodes(tree, (node) => node.type === "Button"),
    [],
  );

  const { useOzonCities: runOzonCities, queries: hookQueries } = await loadQueryHook(
    "use-ozon-cities",
    staleResult,
  );
  for (const [query, enabled] of [
    ["Москва", false],
    ["М", true],
    ["", true],
  ]) {
    const result = runOzonCities(query, enabled);
    assert.equal(hookQueries.at(-1).enabled, false);
    assert.deepEqual(result.cities, []);
    assert.equal(result.isError, false);
    assert.equal(result.isFetching, false);
    assert.equal(result.isPending, false);
  }
  const settled = runOzonCities(" Москва ", true);
  assert.equal(hookQueries.at(-1).enabled, true);
  assert.strictEqual(settled.cities, staleResult.data);
  assert.equal(settled.isError, true);
  assert.equal(settled.isFetching, true);
  assert.equal(settled.isPending, false);
});

test("background fetching and retry preserve locality points without becoming initial loading", async () => {
  const pickupPoints = [cachedPoint];
  for (const isError of [false, true]) {
    const cachedResult = {
      ...idleQuery,
      data: { localityId: cachedCity.id, pickupPoints },
      isError,
      isFetching: true,
    };
    const { useOzonPickupPoints: runOzonPickupPoints } = await loadQueryHook(
      "use-ozon-pickup-points",
      cachedResult,
    );
    const result = runOzonPickupPoints(cachedCity.id);

    assert.strictEqual(result.pickupPoints, pickupPoints);
    assert.equal(result.isPending, false);
    assert.equal(result.isFetching, true);
    assert.equal(result.isError, isError);
    assert.deepEqual(runOzonPickupPoints("another-city").pickupPoints, []);

    const { tree } = await renderSelector({
      cityQuery: "Москва",
      settledQuery: "Москва",
      cityResult: { ...idleQuery, data: [cachedCity] },
      pointResult: cachedResult,
    });
    if (isError) {
      const [retryButton] = findNodes(tree, (node) => node.type === "Button");
      assert.equal(retryButton.props.disabled, true);
      assert.equal(findNodes(retryButton, (node) => node.type === "LoaderCircle").length, 1);
    } else {
      const [map] = findNodes(tree, (node) => node.type === "PickupPointsMap");
      assert.strictEqual(map.props.pickupPoints, pickupPoints);
      assert.equal(
        findNodes(tree, (node) => node.props?.title === "Загружаем пункты выдачи").length,
        0,
      );
    }
  }
});
