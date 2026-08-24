import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, mocks, appendedSource = "") {
  const output = ts.transpileModule(`${source}\n${appendedSource}`, {
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

async function loadClusterPartition() {
  const source = await readSource("src/features/checkout/model/use-ozon-pickup-points.ts");

  assert.match(source, /function partitionOzonMapClusters/);

  return evaluateTypeScript(
    source,
    {
      "@/shared/actions/delivery": {
        getOzonDeliveryMap: () => undefined,
        getOzonDeliveryPoints: () => undefined,
      },
      "@/shared/lib/api-result": { ApiResult: {} },
      "@tanstack/react-query": { useQuery: () => undefined },
      react: { useMemo: () => undefined },
    },
    "export { partitionOzonMapClusters };",
  ).partitionOzonMapClusters;
}

async function loadOzonPickupPointsHook(clusters) {
  const source = await readSource("src/features/checkout/model/use-ozon-pickup-points.ts");
  const pointRequests = [];
  const queryOptions = [];
  let queryIndex = 0;
  const testModule = evaluateTypeScript(source, {
    "@/shared/actions/delivery": {
      getOzonDeliveryMap: () => undefined,
      getOzonDeliveryPoints: async (ids) => {
        pointRequests.push(ids);

        return { data: [] };
      },
    },
    "@/shared/lib/api-result": {
      ApiResult: {
        fromDTO: (result) => ({ unwrap: () => result.data }),
      },
    },
    "@tanstack/react-query": {
      useQuery: (options) => {
        queryOptions.push(options);

        return queryIndex++ === 0
          ? { data: { clusters }, isError: false, isPending: false }
          : { data: [], isError: false, isPending: false };
      },
    },
    react: { useMemo: (factory) => factory() },
  });

  return {
    pointRequests,
    queryOptions,
    useOzonPickupPoints: testModule.useOzonPickupPoints,
  };
}

async function loadMapHelpers() {
  const source = await readSource(
    "src/features/checkout/ui/delivery-selector/pickup-points-map.tsx",
  );

  assert.match(source, /function bindMarkerActivation/);
  assert.match(source, /function restorePendingMarkerFocus/);
  assert.match(source, /function zoomToAggregateCluster/);

  return evaluateTypeScript(
    source,
    {
      "./pickup-points-map.module.css": {},
      "@/shared/lib": { cn: () => "" },
      "lucide-react": { MapPin: () => null },
      react: {
        useEffect: () => undefined,
        useMemo: () => undefined,
        useRef: () => undefined,
        useState: () => undefined,
      },
      "react/jsx-runtime": {
        Fragment: Symbol("Fragment"),
        jsx: () => null,
        jsxs: () => null,
      },
    },
    "export { bindMarkerActivation, restorePendingMarkerFocus, zoomToAggregateCluster };",
  );
}

function createMarkerActivationHarness() {
  const attributes = new Map();
  const elementListeners = new Map();
  const focusCalls = [];
  const markerListeners = new Map();
  let isRemoved = false;
  let syntheticClickCalls = 0;
  const markerElement = {
    addEventListener: (event, listener) => elementListeners.set(event, listener),
    click: () => {
      syntheticClickCalls += 1;
      markerListeners.get("click")?.();
    },
    focus: (options) => focusCalls.push(options),
    removeEventListener: (event, listener) => {
      if (elementListeners.get(event) === listener) {
        elementListeners.delete(event);
      }
    },
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const marker = {
    getElement: () => markerElement,
    off: (event, listener) => {
      if (markerListeners.get(event) === listener) {
        markerListeners.delete(event);
      }

      return marker;
    },
    on: (event, listener) => {
      markerListeners.set(event, listener);

      return marker;
    },
  };

  return {
    attributes,
    elementListeners,
    focusCalls,
    get isRemoved() {
      return isRemoved;
    },
    marker,
    markerElement,
    markerListeners,
    removeElement: () => {
      isRemoved = true;
    },
    get syntheticClickCalls() {
      return syntheticClickCalls;
    },
  };
}

async function loadDeliveryActions() {
  const source = await readSource("src/shared/actions/delivery/delivery.actions.ts");
  const ApiResult = {
    prepareApi: (callback) => async () => {
      try {
        const data = await callback();

        return { toDTO: () => ({ data }) };
      } catch (error) {
        return { toDTO: () => ({ error }) };
      }
    },
  };

  return {
    actions: evaluateTypeScript(source, {
      "@/shared/lib/api-result": { ApiResult },
      "@/shared/lib/api-security": {
        apiCsrfHeader: { "x-artmate-csrf": "1" },
        getForwardedIpHeaders: () => ({}),
      },
      "next/headers": { headers: async () => new Headers() },
    }),
    source,
  };
}

function createOpaqueId(length) {
  const prefix = " Ozon/opaque:001-";
  const suffix = " ";

  return `${prefix}${"x".repeat(length - prefix.length - suffix.length)}${suffix}`;
}

test("clusters without a usable viewport resolve terminal point details", async () => {
  const partitionOzonMapClusters = await loadClusterPartition();
  const actionableAggregate = {
    coordinate: { lat: 55.75, long: 37.6 },
    isSameBuilding: false,
    mapPointIds: ["aggregate-only"],
    pointsCount: 4,
    viewport: {
      leftBottom: { lat: 55.7, long: 37.5 },
      rightTop: { lat: 55.8, long: 37.7 },
    },
  };
  const unavailableWrappedViewport = {
    coordinate: { lat: 55.75, long: 180 },
    isSameBuilding: false,
    mapPointIds: ["terminal-b", "terminal-a"],
    pointsCount: 2,
  };
  const sameBuilding = {
    coordinate: { lat: 55.76, long: 37.61 },
    isSameBuilding: true,
    mapPointIds: ["terminal-c", "terminal-a"],
    pointsCount: 2,
  };

  assert.deepEqual(
    partitionOzonMapClusters([actionableAggregate, unavailableWrappedViewport, sameBuilding]),
    {
      aggregateClusters: [actionableAggregate],
      mapPointIds: ["terminal-a", "terminal-b", "terminal-c"],
    },
  );
});

test("Ozon hook fetches point-info for aggregate IDs when viewport is unavailable", async () => {
  const actionableAggregate = {
    coordinate: { lat: 55.75, long: 37.6 },
    isSameBuilding: false,
    mapPointIds: ["aggregate-only"],
    pointsCount: 4,
    viewport: {
      leftBottom: { lat: 55.7, long: 37.5 },
      rightTop: { lat: 55.8, long: 37.7 },
    },
  };
  const fallbackCluster = {
    coordinate: { lat: 55.75, long: 180 },
    isSameBuilding: false,
    mapPointIds: ["fallback-b", "fallback-a"],
    pointsCount: 2,
  };
  const { pointRequests, queryOptions, useOzonPickupPoints } = await loadOzonPickupPointsHook([
    actionableAggregate,
    fallbackCluster,
  ]);

  const result = useOzonPickupPoints({
    viewport: {
      leftBottom: { lat: 55.5, long: 37.3 },
      rightTop: { lat: 56, long: 37.9 },
    },
    zoom: 11,
  });

  assert.deepEqual(result.aggregateClusters, [actionableAggregate]);
  assert.equal(queryOptions[1].enabled, true);
  assert.deepEqual(queryOptions[1].queryKey, [
    "delivery",
    "ozon",
    "points",
    ["fallback-a", "fallback-b"],
  ]);

  await queryOptions[1].queryFn();

  assert.deepEqual(pointRequests, [["fallback-a", "fallback-b"]]);
});

test("terminal marker click, Enter, and Space each select once and listeners are removed", async () => {
  const { bindMarkerActivation } = await loadMapHelpers();
  const harness = createMarkerActivationHarness();
  const point = { id: "terminal-1", title: "Пункт Ozon" };
  const selections = [];
  const cleanup = bindMarkerActivation(harness.marker, point.title, () => selections.push(point));

  assert.equal(harness.attributes.get("aria-label"), point.title);
  assert.equal(harness.attributes.get("role"), "button");
  assert.equal(harness.attributes.get("tabindex"), "0");

  harness.markerListeners.get("click")();
  assert.deepEqual(selections, [point]);

  let enterPreventDefaultCalls = 0;
  harness.elementListeners.get("keydown")({
    key: "Enter",
    preventDefault: () => {
      enterPreventDefaultCalls += 1;
    },
  });
  assert.deepEqual(selections, [point, point]);
  assert.equal(enterPreventDefaultCalls, 0);

  let spacePreventDefaultCalls = 0;
  harness.elementListeners.get("keydown")({
    key: " ",
    preventDefault: () => {
      spacePreventDefaultCalls += 1;
    },
  });
  assert.deepEqual(selections, [point, point, point]);
  assert.equal(spacePreventDefaultCalls, 1);
  assert.equal(harness.syntheticClickCalls, 0);

  harness.elementListeners.get("keydown")({
    key: "Escape",
    preventDefault: () => assert.fail("Escape must not be handled"),
  });
  assert.deepEqual(selections, [point, point, point]);

  cleanup();
  assert.equal(harness.markerListeners.has("click"), false);
  assert.equal(harness.elementListeners.has("keydown"), false);
});

test("terminal keyboard selection restores focus after marker rebuild without stealing mouse focus", async () => {
  const { bindMarkerActivation, restorePendingMarkerFocus } = await loadMapHelpers();
  const point = { id: "terminal-1", title: "Пункт Ozon" };
  const pendingFocus = { current: undefined };
  let selectedPointId;
  const bindTerminal = (harness) =>
    bindMarkerActivation(
      harness.marker,
      point.title,
      () => {
        selectedPointId = point.id;
      },
      (source) => {
        pendingFocus.current =
          source === "keyboard" && point.id !== selectedPointId ? point.id : undefined;
      },
    );

  const oldKeyboardMarker = createMarkerActivationHarness();
  const cleanupKeyboardMarker = bindTerminal(oldKeyboardMarker);

  oldKeyboardMarker.markerElement.focus();
  oldKeyboardMarker.focusCalls.length = 0;
  oldKeyboardMarker.elementListeners.get("keydown")({ key: "Enter", preventDefault: () => {} });
  cleanupKeyboardMarker();
  oldKeyboardMarker.removeElement();

  const rebuiltKeyboardMarker = createMarkerActivationHarness();

  restorePendingMarkerFocus(
    pendingFocus,
    selectedPointId,
    rebuiltKeyboardMarker.marker.getElement(),
  );
  restorePendingMarkerFocus(
    pendingFocus,
    selectedPointId,
    rebuiltKeyboardMarker.marker.getElement(),
  );

  assert.equal(oldKeyboardMarker.isRemoved, true);
  assert.deepEqual(rebuiltKeyboardMarker.focusCalls, [{ preventScroll: true }]);
  assert.equal(pendingFocus.current, undefined);

  selectedPointId = undefined;
  const oldMouseMarker = createMarkerActivationHarness();
  const cleanupMouseMarker = bindTerminal(oldMouseMarker);

  oldMouseMarker.markerListeners.get("click")();
  cleanupMouseMarker();
  oldMouseMarker.removeElement();

  const rebuiltMouseMarker = createMarkerActivationHarness();

  restorePendingMarkerFocus(pendingFocus, selectedPointId, rebuiltMouseMarker.marker.getElement());

  assert.equal(oldMouseMarker.isRemoved, true);
  assert.deepEqual(rebuiltMouseMarker.focusCalls, []);

  selectedPointId = point.id;
  const sameIdMarker = createMarkerActivationHarness();
  const cleanupSameIdMarker = bindTerminal(sameIdMarker);

  sameIdMarker.elementListeners.get("keydown")({ key: " ", preventDefault: () => {} });
  cleanupSameIdMarker();

  const rebuiltSameIdMarker = createMarkerActivationHarness();

  restorePendingMarkerFocus(pendingFocus, selectedPointId, rebuiltSameIdMarker.marker.getElement());

  assert.deepEqual(rebuiltSameIdMarker.focusCalls, []);

  const missingTargetFocus = { current: point.id };

  restorePendingMarkerFocus(missingTargetFocus, point.id, null);

  const laterMarker = createMarkerActivationHarness();

  restorePendingMarkerFocus(missingTargetFocus, point.id, laterMarker.marker.getElement());

  assert.equal(missingTargetFocus.current, undefined);
  assert.deepEqual(laterMarker.focusCalls, []);
});

test("aggregate marker click, Enter, and Space each perform one zoom", async () => {
  const { bindMarkerActivation, zoomToAggregateCluster } = await loadMapHelpers();
  const harness = createMarkerActivationHarness();
  const clusterBounds = {
    getCenter: () => ({ lat: 55.75, lng: 37.6 }),
  };
  const transitions = [];
  let currentZoom = 11;
  const map = {
    getBoundsZoom: () => 11,
    getZoom: () => currentZoom,
    setView: (center, zoom, options) => {
      transitions.push({ center, options, zoom });
      currentZoom = zoom;
    },
  };
  const leaflet = {
    latLngBounds: () => clusterBounds,
    point: (x, y) => ({ x, y }),
  };
  const viewport = {
    leftBottom: { lat: 55.7, long: 37.5 },
    rightTop: { lat: 55.8, long: 37.7 },
  };
  const activate = () => zoomToAggregateCluster(map, leaflet, viewport);
  const ariaLabel = "Приблизить область: 3 точки Ozon";
  const cleanup = bindMarkerActivation(harness.marker, ariaLabel, activate);

  assert.equal(harness.attributes.get("aria-label"), ariaLabel);

  harness.markerListeners.get("click")();
  assert.equal(transitions.length, 1);

  let enterPreventDefaultCalls = 0;
  harness.elementListeners.get("keydown")({
    key: "Enter",
    preventDefault: () => {
      enterPreventDefaultCalls += 1;
    },
  });
  assert.equal(transitions.length, 2);
  assert.equal(enterPreventDefaultCalls, 0);

  let spacePreventDefaultCalls = 0;
  harness.elementListeners.get("keydown")({
    key: " ",
    preventDefault: () => {
      spacePreventDefaultCalls += 1;
    },
  });
  assert.equal(transitions.length, 3);
  assert.equal(spacePreventDefaultCalls, 1);
  assert.equal(harness.syntheticClickCalls, 0);

  harness.elementListeners.get("keydown")({
    key: "Escape",
    preventDefault: () => assert.fail("Escape must not be handled"),
  });
  assert.equal(transitions.length, 3);

  cleanup();
  assert.equal(harness.markerListeners.has("click"), false);
  assert.equal(harness.elementListeners.has("keydown"), false);
});

test("site point-info action accepts exact 160-character IDs and rejects boundary plus one", async () => {
  const { actions } = await loadDeliveryActions();
  const exactId = createOpaqueId(160);
  const oversizedId = createOpaqueId(161);
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (...request) => {
    requests.push(request);

    return {
      json: async () => [],
      ok: true,
    };
  };

  try {
    const accepted = await actions.getOzonDeliveryPoints([exactId]);

    assert.deepEqual(accepted, { data: [] });
    assert.deepEqual(JSON.parse(requests[0][1].body), {
      mapPointIds: [exactId],
    });

    const rejected = await actions.getOzonDeliveryPoints([oversizedId]);

    assert.equal(rejected.error instanceof Error, true);
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("new site delivery constants use camelCase names", async () => {
  const { source } = await loadDeliveryActions();

  assert.match(source, /const defaultApiBaseUrl =/);
  assert.match(source, /const maxOzonPointInfoIds =/);
  assert.match(source, /const maxOzonPointInfoIdLength =/);
  assert.match(source, /const ozonPointInfoConcurrency =/);
  assert.doesNotMatch(
    source,
    /\b(?:DEFAULT_API_BASE_URL|MAX_OZON_POINT_INFO_IDS|MAX_OZON_POINT_INFO_ID_LENGTH|OZON_POINT_INFO_CONCURRENCY)\b/,
  );
});
