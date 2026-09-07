import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("map markers and zoom controls expose 44px interactive targets", async () => {
  const [map, styles] = await Promise.all([
    readSource("src/features/checkout/ui/delivery-selector/pickup-points-map.tsx"),
    readSource("src/features/checkout/ui/delivery-selector/pickup-points-map.module.css"),
  ]);

  assert.equal(map.match(/iconSize: \[44, 44\]/gu)?.length, 3);
  assert.equal(map.match(/iconAnchor: \[22, 22\]/gu)?.length, 3);
  assert.match(styles, /\.markerShell\s*\{[^}]*height:\s*44px;[^}]*width:\s*44px;/su);
  assert.match(styles, /\.marker\s*\{[^}]*height:\s*18px;[^}]*width:\s*18px;/su);
  assert.match(styles, /\.markerSelected\s*\{[^}]*height:\s*24px;[^}]*width:\s*24px;/su);
  assert.match(
    styles,
    /\.clusterMarker\s*\{[^}]*height:\s*40px;[^}]*min-width:\s*40px;[^}]*width:\s*40px;/su,
  );
  assert.match(styles, /leaflet-control-zoom[^}]*min-height:\s*44px;[^}]*min-width:\s*44px;/su);
});

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
      "../../lib": { clusterPickupPoints: () => [] },
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

async function loadMapCameraHelpers() {
  const source = await readSource(
    "src/features/checkout/ui/delivery-selector/pickup-points-map.tsx",
  );

  assert.match(source, /function fitMapToGeoPointsOnce/);
  assert.match(source, /function focusMapOnCoordinatesOnce/);
  assert.match(source, /scrollWheelZoom: true/);
  assert.match(source, /touchZoom: true/);
  const markerReconciliation = source.slice(
    source.indexOf("markerLayer.clearLayers()"),
    source.indexOf("fitMapToGeoPointsOnce(map"),
  );

  assert.doesNotMatch(markerReconciliation, /fitBounds/);
  assert.match(markerReconciliation, /onSelectRef\.current\(point\)/);

  return evaluateTypeScript(
    source,
    {
      "./pickup-points-map.module.css": {},
      "../../lib": { clusterPickupPoints: () => [] },
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
    "export { bindMarkerActivation, fitMapToGeoPointsOnce, focusMapOnCoordinatesOnce };",
  );
}

async function renderOzonDeliverySelector(ozonPickupPoints, options = {}) {
  const source = await readSource(
    "src/features/checkout/ui/delivery-selector/delivery-selector.tsx",
  );
  const jsx = (type, props, key) => ({ key, props, type });
  const component = (name) => name;
  const { DeliverySelector } = evaluateTypeScript(source, {
    "../../lib": {
      clearCdekDraftCity: (drafts) => ({ ...drafts, cdek: {} }),
      clearOzonDraftCity: (drafts) => ({ ...drafts, ozon: {} }),
      filterPickupPoints: (points) => points,
      formatPickupPointCount: (count) => `${count} ПВЗ`,
      getOzonDraftInitialView: () => ({ center: { lat: 55.75, long: 37.62 }, zoom: 11 }),
      getOzonLocatorMapFocus: () => options.mapFocus,
      selectDraftCity: (drafts) => drafts,
      selectDraftPickupPoint: (drafts) => drafts,
      selectOzonDraftCity: (drafts) => drafts,
      setOzonDraftMapRequest: (drafts) => drafts,
    },
    "../../model": {
      useCdekCities: () => ({ cities: [], isError: false, isPending: false }),
      useCdekPickupPoints: (cityCode) =>
        cityCode !== undefined && cityCode === options.drafts?.ozon?.cityCode
          ? (options.locator ?? {
              isError: false,
              isPending: false,
              pickupPoints: [],
              resolvedCityCode: cityCode,
            })
          : { isError: false, isPending: false, pickupPoints: [] },
      useOzonPickupPoints: () => ozonPickupPoints,
    },
    "./combobox-field": { ComboboxField: component("ComboboxField") },
    "./combobox-option": { ComboboxOption: component("ComboboxOption") },
    "./delivery-company-selector": {
      DeliveryCompanySelector: component("DeliveryCompanySelector"),
    },
    "./delivery-options": { defaultDeliveryCompany: "cdek" },
    "./map-placeholder": { MapPlaceholder: component("MapPlaceholder") },
    "./pickup-points-map": { PickupPointsMap: component("PickupPointsMap") },
    "@/shared/lib": { cn: (...classes) => classes.filter(Boolean).join(" ") },
    "@/shared/ui": {
      Card: component("Card"),
      CardContent: component("CardContent"),
      CardDescription: component("CardDescription"),
      CardHeader: component("CardHeader"),
      CardTitle: component("CardTitle"),
    },
    "lucide-react": {
      CheckCircle2: component("CheckCircle2"),
      CircleAlert: component("CircleAlert"),
      LoaderCircle: component("LoaderCircle"),
      MapPin: component("MapPin"),
    },
    react: {
      useEffect: () => undefined,
      useMemo: (factory) => factory(),
      useState: (initialValue) => [
        typeof initialValue === "function" ? initialValue() : initialValue,
        () => undefined,
      ],
    },
    "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
  });

  return DeliverySelector({
    drafts: options.drafts ?? { cdek: {}, ozon: {} },
    isOzonDeliveryAvailable: true,
    onCompanyChange: () => undefined,
    onDraftChange: () => undefined,
    selectedCompany: options.selectedCompany ?? "ozon",
  });
}

function findRenderedNode(node, predicate) {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  if (predicate(node)) {
    return node;
  }

  const children = Array.isArray(node) ? node : node.props?.children;

  for (const child of Array.isArray(children) ? children : [children]) {
    const match = findRenderedNode(child, predicate);

    if (match) {
      return match;
    }
  }

  return undefined;
}

function findRenderedNodes(node, predicate, matches = []) {
  if (!node || typeof node !== "object") return matches;
  if (predicate(node)) matches.push(node);
  const children = Array.isArray(node) ? node : node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    findRenderedNodes(child, predicate, matches);
  }

  return matches;
}

function getRenderedText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  const children = Array.isArray(node) ? node : node.props?.children;

  return (Array.isArray(children) ? children : [children]).map(getRenderedText).join("");
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

async function loadDeliveryActions(cartId) {
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
      "next/headers": {
        cookies: async () => ({
          get: (name) => (name === "cart_id" && cartId ? { value: cartId } : undefined),
        }),
        headers: async () => new Headers(),
      },
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

test("rendered Ozon statuses stay distinct within identical accessible one-line geometry", async () => {
  const states = [
    {
      expected: "Загружаем ПВЗ на карте.",
      value: { aggregateClusters: [], isError: false, isPending: true, pickupPoints: [] },
    },
    {
      expected: "Не удалось загрузить ПВЗ. Попробуйте позже.",
      value: { aggregateClusters: [], isError: true, isPending: false, pickupPoints: [] },
    },
    {
      expected: "Доступно 2 ПВЗ и группы ПВЗ.",
      value: {
        aggregateClusters: [{ id: "cluster" }],
        isError: false,
        isPending: false,
        pickupPoints: [{ id: "one" }, { id: "two" }],
      },
    },
    {
      expected: "В области 2 ПВЗ.",
      value: {
        aggregateClusters: [],
        isError: false,
        isPending: false,
        pickupPoints: [{ id: "one" }, { id: "two" }],
      },
    },
    {
      expected: "На карте есть группы ПВЗ - приблизьте их.",
      value: {
        aggregateClusters: [{ id: "cluster" }],
        isError: false,
        isPending: false,
        pickupPoints: [],
      },
    },
    {
      expected: "ПВЗ не найдены - измените область карты.",
      value: { aggregateClusters: [], isError: false, isPending: false, pickupPoints: [] },
    },
  ];
  const statusClassNames = [];

  for (const { expected, value } of states) {
    const rendered = await renderOzonDeliverySelector(value, {
      drafts: { cdek: {}, ozon: { mapRequest: { viewport: {}, zoom: 11 } } },
    });
    const status = findRenderedNode(
      rendered,
      (node) => node.type === "p" && node.props?.title === expected,
    );
    const statusColumn = findRenderedNode(
      rendered,
      (node) =>
        node.type === "div" &&
        node.props?.className?.split(" ").includes("space-y-4") &&
        findRenderedNode(
          node,
          (child) => child.type === "p" && child.props?.title === expected,
        ),
    );

    assert.ok(status);
    assert.equal(status.props.role, "status");
    assert.equal(status.props.children, expected);
    assert.equal(status.props["aria-atomic"], true);
    assert.equal(status.props.title, expected);
    assert.deepEqual(status.props.className.split(" "), [
      "h-5",
      "min-w-0",
      "truncate",
      "text-sm",
      "leading-5",
      "text-muted-foreground",
    ]);
    assert.equal(statusColumn.props.className.split(" ").includes("min-w-0"), true);
    statusClassNames.push(status.props.className);
  }

  assert.equal(new Set(statusClassNames).size, 1);
});

test("Ozon renders city locator before its pickup field with clear fallback statuses", async () => {
  const rendered = await renderOzonDeliverySelector(
    { aggregateClusters: [], isError: false, isPending: false, pickupPoints: [] },
    {
      drafts: {
        cdek: {},
        ozon: {
          city: { code: 137, countryCode: "RU", name: "Санкт-Петербург" },
          cityCode: 137,
        },
      },
      locator: {
        isError: false,
        isPending: false,
        pickupPoints: [],
        resolvedCityCode: 137,
      },
    },
  );
  const fields = [];
  const orderedNodes = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "ComboboxField") fields.push(node);
    if (node.type === "ComboboxField" || node.props?.role === "status") orderedNodes.push(node);
    const children = Array.isArray(node) ? node : node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) visit(child);
  };

  visit(rendered);

  assert.equal(fields[0].props.label, "Город");
  assert.equal(fields[0].props.placeholder, "Начните вводить город");
  assert.equal(fields[1].props.label, "Пункт выдачи Ozon");
  assert.deepEqual(
    orderedNodes.slice(0, 3).map((node) => node.props.label ?? node.props.role),
    ["Город", "status", "Пункт выдачи Ozon"],
  );
  assert.match(
    getRenderedText(orderedNodes[1]),
    /Не удалось автоматически определить область города\. Переместите карту вручную\./u,
  );
  assert.doesNotMatch(getRenderedText(rendered), /СДЭК/u);
});

test("selected Ozon city announces only locator progress before the first map request", async () => {
  const rendered = await renderOzonDeliverySelector(
    { aggregateClusters: [], isError: false, isPending: false, pickupPoints: [] },
    {
      drafts: {
        cdek: {},
        ozon: {
          city: { code: 137, countryCode: "RU", name: "Санкт-Петербург" },
          cityCode: 137,
        },
      },
      locator: {
        isError: false,
        isPending: true,
        pickupPoints: [],
        resolvedCityCode: undefined,
      },
    },
  );
  const statuses = findRenderedNodes(rendered, (node) => node.props?.role === "status");

  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].props["aria-live"], "polite");
  assert.equal(statuses[0].props["aria-atomic"], true);
  assert.match(getRenderedText(statuses[0]), /Определяем область выбранного города\./u);
  assert.doesNotMatch(getRenderedText(rendered), /ПВЗ не найдены/u);
});

test("Ozon locator points define map focus without becoming pickup markers", async () => {
  const locatorPoint = { id: "CDEK-LOCATOR", latitude: 59.93, longitude: 30.31 };
  const ozonPoint = { id: "OZON-POINT", latitude: 59.94, longitude: 30.32 };
  const mapFocus = {
    key: "ozon-city:137",
    points: [{ lat: locatorPoint.latitude, long: locatorPoint.longitude }],
  };
  const rendered = await renderOzonDeliverySelector(
    { aggregateClusters: [], isError: false, isPending: false, pickupPoints: [ozonPoint] },
    {
      drafts: { cdek: {}, ozon: { cityCode: 137 } },
      locator: {
        isError: false,
        isPending: false,
        pickupPoints: [locatorPoint],
        resolvedCityCode: 137,
      },
      mapFocus,
    },
  );
  const map = findRenderedNode(rendered, (node) => node.type === "PickupPointsMap");

  assert.strictEqual(map.props.focus, mapFocus);
  assert.deepEqual(map.props.pickupPoints, [ozonPoint]);
  assert.equal(map.props.pickupPoints.includes(locatorPoint), false);
});

test("CDEK and Ozon maps have different React identities when switching carriers", async () => {
  const points = { aggregateClusters: [], isError: false, isPending: false, pickupPoints: [] };
  const cdek = await renderOzonDeliverySelector(points, {
    drafts: { cdek: { cityCode: 44 }, ozon: {} },
    selectedCompany: "cdek",
  });
  const ozon = await renderOzonDeliverySelector(points);
  const cdekMap = findRenderedNode(cdek, (node) => node.type === "PickupPointsMap");
  const ozonMap = findRenderedNode(ozon, (node) => node.type === "PickupPointsMap");

  assert.ok(cdekMap);
  assert.ok(ozonMap);
  assert.notEqual(cdekMap.key, ozonMap.key);
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

test("map fits geo points once while moveend, cluster zoom, and point selection preserve interactions", async () => {
  const { bindMarkerActivation, fitMapToGeoPointsOnce } = await loadMapCameraHelpers();
  const fitKeyRef = { current: undefined };
  const fitBoundsCalls = [];
  const points = [
    { id: "one", latitude: 55.75, longitude: 37.61 },
    { id: "two", latitude: 55.76, longitude: 37.62 },
  ];
  let currentZoom = 11;
  const map = {
    fitBounds: (bounds, options) => {
      fitBoundsCalls.push({ bounds, options });
      currentZoom = options.maxZoom;
    },
    getZoom: () => currentZoom,
    setView: (_center, zoom) => {
      currentZoom = zoom;
    },
  };

  fitMapToGeoPointsOnce(map, points, "moscow:one,two", fitKeyRef);
  assert.equal(fitBoundsCalls.length, 1);

  currentZoom = 12;
  fitMapToGeoPointsOnce(map, points, "moscow:one,two", fitKeyRef);
  assert.equal(fitBoundsCalls.length, 1);
  assert.equal(currentZoom, 12);

  const clusterHarness = createMarkerActivationHarness();
  const cleanupCluster = bindMarkerActivation(clusterHarness.marker, "2 пункта", () => {
    map.setView([55.755, 37.615], Math.min(19, map.getZoom() + 2), { animate: false });
  });

  clusterHarness.markerListeners.get("click")();
  fitMapToGeoPointsOnce(map, points, "moscow:one,two", fitKeyRef);
  assert.equal(fitBoundsCalls.length, 1);
  assert.equal(currentZoom, 14);

  fitMapToGeoPointsOnce(map, points, "saint-petersburg:one,two", fitKeyRef);
  assert.equal(fitBoundsCalls.length, 2);

  const pointHarness = createMarkerActivationHarness();
  const selections = [];
  const cleanupPoint = bindMarkerActivation(pointHarness.marker, "ПВЗ", () =>
    selections.push(points[0]),
  );

  pointHarness.markerListeners.get("click")();
  assert.deepEqual(selections, [points[0]]);

  cleanupCluster();
  cleanupPoint();
});

test("city locator focus moves the map once and leaves later pan and zoom untouched", async () => {
  const { focusMapOnCoordinatesOnce } = await loadMapCameraHelpers();
  const focusKeyRef = { current: undefined };
  const calls = [];
  const map = {
    fitBounds: (bounds, options) => calls.push({ bounds, options, type: "bounds" }),
    setView: (center, zoom) => calls.push({ center, type: "center", zoom }),
  };
  const focus = {
    key: "ozon-city:137",
    points: [
      { lat: 59.9, long: 30.2 },
      { lat: 60, long: 30.4 },
    ],
  };

  focusMapOnCoordinatesOnce(map, focus.points, focus.key, focusKeyRef);
  assert.deepEqual(calls, [
    {
      bounds: [
        [59.9, 30.2],
        [60, 30.4],
      ],
      options: { maxZoom: 13, padding: [24, 24] },
      type: "bounds",
    },
  ]);

  focusMapOnCoordinatesOnce(map, focus.points, focus.key, focusKeyRef);
  assert.equal(calls.length, 1);

  focusMapOnCoordinatesOnce(map, [], undefined, focusKeyRef);
  focusMapOnCoordinatesOnce(map, focus.points, focus.key, focusKeyRef);
  assert.equal(calls.length, 2);

  focusMapOnCoordinatesOnce(map, [{ lat: 56.01, long: 92.87 }], "ozon-city:278", focusKeyRef);
  assert.deepEqual(calls[2], {
    center: [56.01, 92.87],
    type: "center",
    zoom: 13,
  });
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

test("site delivery proxy forwards only the cart identity cookie", async () => {
  const { actions } = await loadDeliveryActions("cart value");
  const originalFetch = globalThis.fetch;
  let requestInit;

  globalThis.fetch = async (_url, init) => {
    requestInit = init;

    return {
      json: async () => [],
      ok: true,
    };
  };

  try {
    await actions.searchCdekCities("Москва");

    assert.equal(requestInit.headers.cookie, "cart_id=cart%20value");
    assert.doesNotMatch(requestInit.headers.cookie, /access|refresh|session/i);
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
