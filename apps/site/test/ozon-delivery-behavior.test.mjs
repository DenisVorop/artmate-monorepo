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

  assert.equal(map.match(/iconSize: \[44, 44\]/gu)?.length, 2);
  assert.equal(map.match(/iconAnchor: \[22, 22\]/gu)?.length, 2);
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

async function loadCityScopedOzonPickupPointsHook(queryResult) {
  const source = await readSource("src/features/checkout/model/use-ozon-pickup-points.ts");
  const actionCalls = [];
  let queryOptions;
  const testModule = evaluateTypeScript(source, {
    "@/shared/actions/delivery": {
      getOzonPickupPoints: async (localityId) => {
        actionCalls.push(localityId);
        return { data: [{ id: "point-81" }] };
      },
    },
    "@/shared/lib/api-result": {
      ApiResult: {
        fromDTO: (result) => ({ unwrap: () => result.data }),
      },
    },
    "@tanstack/react-query": {
      useQuery: (options) => {
        queryOptions = options;
        return queryResult;
      },
    },
  });

  return {
    actionCalls,
    get queryOptions() {
      return queryOptions;
    },
    useOzonPickupPoints: testModule.useOzonPickupPoints,
  };
}

async function loadMapHelpers() {
  const source = await readSource(
    "src/features/checkout/ui/delivery-selector/pickup-points-map.tsx",
  );

  assert.match(source, /function bindMarkerActivation/);
  assert.match(source, /function restorePendingMarkerFocus/);

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
    "export { bindMarkerActivation, restorePendingMarkerFocus };",
  );
}

async function loadMapCameraHelpers() {
  const source = await readSource(
    "src/features/checkout/ui/delivery-selector/pickup-points-map.tsx",
  );

  assert.match(source, /function fitMapToGeoPointsOnce/);
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
    "export { bindMarkerActivation, fitMapToGeoPointsOnce };",
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
      selectDraftCity: (drafts) => drafts,
      selectDraftPickupPoint: (drafts) => drafts,
      selectOzonDraftCity: (drafts) => drafts,
      useDebouncedCityQuery: (query) => query.trim(),
    },
    "../../model": {
      useCdekCities: () => ({ cities: [], isError: false, isPending: false }),
      useCdekPickupPoints: () => ({ isError: false, isPending: false, pickupPoints: [] }),
      useOzonCities: () => ({
        cities: options.ozonCities ?? [],
        isError: false,
        isPending: false,
        retry: () => undefined,
      }),
      useOzonPickupPoints: (localityId) => {
        options.onOzonPickupPointsRequest?.(localityId);

        return { retry: () => undefined, ...ozonPickupPoints };
      },
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
    "@/shared/ui/button": { Button: component("Button") },
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

test("rendered Ozon statuses stay distinct within identical accessible one-line geometry", async () => {
  const states = [
    {
      expected: "Загружаем ПВЗ выбранного города.",
      value: { isError: false, isPending: true, pickupPoints: [] },
    },
    {
      expected: "Не удалось загрузить ПВЗ. Попробуйте ещё раз.",
      value: { isError: true, isPending: false, pickupPoints: [] },
    },
    {
      expected: "Нашли 2 ПВЗ. Выберите адрес в списке или на карте.",
      value: {
        isError: false,
        isPending: false,
        pickupPoints: [{ id: "one" }, { id: "two" }],
      },
    },
    {
      expected: "Для этого города пункты выдачи пока не найдены.",
      value: { isError: false, isPending: false, pickupPoints: [] },
    },
  ];
  const statusClassNames = [];

  for (const { expected, value } of states) {
    const rendered = await renderOzonDeliverySelector(value, {
      drafts: {
        cdek: {},
        ozon: { localityId: "city-44" },
      },
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
        findRenderedNode(node, (child) => child.type === "p" && child.props?.title === expected),
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

test("Ozon waits for a city before mounting the map or requesting pickup points", async () => {
  const requests = [];
  const rendered = await renderOzonDeliverySelector(
    { isError: false, isPending: false, pickupPoints: [] },
    {
      drafts: {
        cdek: {},
        ozon: {
          pickupPoint: { address: "Старый ПВЗ", id: "stale-point" },
        },
      },
      onOzonPickupPointsRequest: (request) => requests.push(request),
    },
  );
  const pickupField = findRenderedNode(
    rendered,
    (node) => node.type === "ComboboxField" && node.props?.label === "Пункт выдачи Ozon",
  );
  const status = findRenderedNode(rendered, (node) => node.props?.role === "status");
  const placeholder = findRenderedNode(rendered, (node) => node.type === "MapPlaceholder");

  assert.deepEqual(requests, [undefined]);
  assert.equal(
    findRenderedNode(rendered, (node) => node.type === "PickupPointsMap"),
    undefined,
  );
  assert.ok(placeholder);
  assert.equal(placeholder.props.compact, true);
  assert.equal(placeholder.props.title, "Начните с города");
  assert.match(
    getRenderedText(placeholder),
    /После выбора города покажем доступные ПВЗ и карту рядом со списком\./u,
  );
  assert.equal(pickupField.props.disabled, true);
  assert.equal(pickupField.props.emptyText, "Сначала выберите город");
  assert.equal(pickupField.props.selectedLabel, undefined);
  assert.equal(pickupField.props.triggerLabel, "Сначала выберите город");
  assert.equal(status.props.children, "Сначала выберите город, чтобы увидеть доступные ПВЗ.");
  assert.equal(
    findRenderedNode(rendered, (node) => node.type?.name === "SelectedPickupPoint"),
    undefined,
  );
  assert.equal(
    findRenderedNode(rendered, (node) => node.type === "ComboboxOption"),
    undefined,
  );
});

test("Ozon pickup query is locality-scoped, disabled before city, and rejects late city data", async () => {
  const disabled = await loadCityScopedOzonPickupPointsHook({
    data: undefined,
    isError: false,
    isPending: false,
    refetch: () => undefined,
  });
  const disabledResult = disabled.useOzonPickupPoints(undefined);

  assert.equal(disabled.queryOptions.enabled, false);
  assert.deepEqual(disabled.queryOptions.queryKey, [
    "delivery",
    "ozon",
    "pickup-points",
    undefined,
  ]);
  assert.deepEqual(disabledResult.pickupPoints, []);

  const cityB = await loadCityScopedOzonPickupPointsHook({
    data: { localityId: "city-a", pickupPoints: [{ id: "late-a" }] },
    isError: false,
    isPending: false,
    refetch: () => undefined,
  });
  const cityBResult = cityB.useOzonPickupPoints("city-b");

  assert.equal(cityB.queryOptions.enabled, true);
  assert.deepEqual(cityB.queryOptions.queryKey, ["delivery", "ozon", "pickup-points", "city-b"]);
  assert.equal(cityB.queryOptions.staleTime >= 30_000, true);
  assert.equal(cityB.queryOptions.staleTime <= 60_000, true);
  assert.equal(cityB.queryOptions.gcTime, 5 * 60_000);
  assert.deepEqual(cityBResult.pickupPoints, []);

  await cityB.queryOptions.queryFn();
  assert.deepEqual(cityB.actionCalls, ["city-b"]);
});

test("Ozon city search debounces 300ms and uses short-lived query caching", async () => {
  const [debounce, source] = await Promise.all([
    readSource("src/features/checkout/lib/use-debounced-city-query.ts"),
    readSource("src/features/checkout/model/use-ozon-cities.ts"),
  ]);

  assert.match(
    debounce,
    /window\.setTimeout\(\(\) => setDebouncedQuery\(normalizedQuery\), 300\)/u,
  );
  assert.match(source, /queryKey: \["delivery", "ozon", "cities", normalizedQuery\]/u);
  assert.match(source, /gcTime: 5 \* 60_000/u);
  assert.match(source, /staleTime: 60_000/u);
  assert.match(source, /enabled: shouldSearch/u);
});

test("Ozon selector uses its own cities and keeps the full city dataset on the map", async () => {
  const selector = await readSource(
    "src/features/checkout/ui/delivery-selector/delivery-selector.tsx",
  );

  assert.match(selector, /useOzonCities\([\s\S]*ozonCityQuery,[\s\S]*selectedCompany === "ozon"/u);
  assert.match(
    selector,
    /useOzonPickupPoints\([\s\S]*selectedCompany === "ozon"[\s\S]*ozonLocalityId/u,
  );
  assert.match(selector, /pickupPoints=\{ozonPickupPoints\.pickupPoints\}/u);
  assert.doesNotMatch(selector, /visibleOzonPoints\.slice\(0,\s*80\)/u);
  assert.doesNotMatch(selector, /selectedOzonPoint,[\s\S]*ozonPickupPoints\.pickupPoints\.filter/u);
  assert.doesNotMatch(
    selector,
    /getOzonLocatorMapFocus|setOzonDraftMapRequest|aggregateClusters|ozonMapRequest/u,
  );
});

test("Ozon list and map retain a pickup point beyond the first 80 results", async () => {
  const pickupPoints = Array.from({ length: 81 }, (_unused, index) => ({
    address: `Адрес ${index + 1}`,
    id: `point-${index + 1}`,
    latitude: 55.7 + index / 10_000,
    longitude: 37.6 + index / 10_000,
    title: `ПВЗ ${index + 1}`,
    workHours: "ежедневно",
  }));
  const rendered = await renderOzonDeliverySelector(
    { isError: false, isPending: false, pickupPoints },
    { drafts: { cdek: {}, ozon: { localityId: "city-44" } } },
  );
  const options = findRenderedNodes(
    rendered,
    (node) => node.type === "ComboboxOption" && node.props?.label?.startsWith("Адрес "),
  );
  const map = findRenderedNode(rendered, (node) => node.type === "PickupPointsMap");

  assert.equal(options.length, 81);
  assert.equal(
    options.some((option) => option.key === "point-81"),
    true,
  );
  assert.strictEqual(map.props.pickupPoints, pickupPoints);
});

test("CDEK and Ozon maps have different React identities when switching carriers", async () => {
  const point = { id: "ozon", latitude: 55.75, longitude: 37.62 };
  const points = { isError: false, isPending: false, pickupPoints: [point] };
  const cdek = await renderOzonDeliverySelector(points, {
    drafts: { cdek: { cityCode: 44 }, ozon: {} },
    selectedCompany: "cdek",
  });
  const ozon = await renderOzonDeliverySelector(points, {
    drafts: { cdek: {}, ozon: { localityId: "city-44" } },
  });
  const cdekMap = findRenderedNode(cdek, (node) => node.type === "PickupPointsMap");
  const ozonMap = findRenderedNode(ozon, (node) => node.type === "PickupPointsMap");

  assert.ok(cdekMap);
  assert.ok(ozonMap);
  assert.notEqual(cdekMap.key, ozonMap.key);
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

test("map fits geo points once while cluster zoom and point selection preserve interactions", async () => {
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

test("site Ozon delivery proxy uses city-first GET endpoints without legacy map requests", async () => {
  const { actions, source } = await loadDeliveryActions();
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
    await actions.searchOzonCities("Сан");
    await actions.getOzonPickupPoints("locality-137");

    assert.equal(requests[0][0].endsWith("/delivery/ozon/cities?query=%D0%A1%D0%B0%D0%BD"), true);
    assert.equal(
      requests[1][0].endsWith("/delivery/ozon/pickup-points?localityId=locality-137"),
      true,
    );
    assert.equal(requests[0][1].method, undefined);
    assert.equal(requests[1][1].method, undefined);
    assert.doesNotMatch(source, /delivery\/ozon\/(?:map|points\/info)/u);
    assert.doesNotMatch(source, /mapPointIds|chunk\(|ozonPointInfo/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("new site delivery constants use camelCase names", async () => {
  const { source } = await loadDeliveryActions();

  assert.match(source, /const defaultApiBaseUrl =/);
  assert.match(source, /const ozonCitiesErrorMessage =/);
  assert.match(source, /const ozonPointsErrorMessage =/);
  assert.doesNotMatch(
    source,
    /\b(?:DEFAULT_API_BASE_URL|OZON_CITIES_ERROR_MESSAGE|OZON_POINTS_ERROR_MESSAGE)\b/,
  );
});
