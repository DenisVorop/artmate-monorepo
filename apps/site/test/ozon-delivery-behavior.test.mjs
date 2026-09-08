import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, mocks) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const testModule = { exports: {} };

  new Function("require", "module", "exports", output)(
    (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      throw new Error(`Unexpected test module import: ${specifier}`);
    },
    testModule,
    testModule.exports,
  );

  return testModule.exports;
}

async function loadDeliverySelectorLib() {
  return evaluateTypeScript(await readSource("src/features/checkout/lib/delivery-selector.ts"), {});
}

async function createPickupComboboxHarness({ deferValue = (value) => value } = {}) {
  const source = await readSource(
    "src/features/checkout/ui/delivery-selector/pickup-point-combobox.tsx",
  );
  const checkoutLib = await loadDeliverySelectorLib();
  const states = [];
  const memos = [];
  const callbacks = [];
  const refs = [];
  const virtualizerOptions = [];
  let callbackCursor = 0;
  let memoCursor = 0;
  let refCursor = 0;
  let stateCursor = 0;
  const sameDependencies = (left, right) =>
    Boolean(
      left && right && left.length === right.length && left.every((value, i) => value === right[i]),
    );
  const jsx = (type, props, key) => ({ key, props, type });
  const react = {
    useCallback: (callback, dependencies) => {
      const index = callbackCursor++;
      const previous = callbacks[index];
      if (previous && sameDependencies(previous.dependencies, dependencies)) return previous.value;
      callbacks[index] = { dependencies, value: callback };
      return callback;
    },
    useDeferredValue: deferValue,
    useEffect: () => undefined,
    useId: () => "pickup-list",
    useMemo: (factory, dependencies) => {
      const index = memoCursor++;
      const previous = memos[index];
      if (previous && sameDependencies(previous.dependencies, dependencies)) return previous.value;
      const value = factory();
      memos[index] = { dependencies, value };
      return value;
    },
    useRef: (initialValue) => {
      const index = refCursor++;
      refs[index] ??= { current: initialValue };
      return refs[index];
    },
    useState: (initialValue) => {
      const index = stateCursor++;
      if (!(index in states)) states[index] = initialValue;
      return [
        states[index],
        (update) => {
          states[index] = typeof update === "function" ? update(states[index]) : update;
        },
      ];
    },
  };
  const { PickupPointCombobox } = evaluateTypeScript(source, {
    "../../lib": checkoutLib,
    "./combobox-field": { ComboboxField: "ComboboxField" },
    "./combobox-option": { ComboboxOption: "ComboboxOption" },
    "@tanstack/react-virtual": {
      defaultRangeExtractor: ({ startIndex, endIndex }) =>
        Array.from({ length: endIndex - startIndex + 1 }, (_, index) => startIndex + index),
      useVirtualizer: (options) => {
        virtualizerOptions.push(options);
        return {
          getTotalSize: () => options.count * 72,
          getVirtualItems: () =>
            options.count > 0 ? [{ index: 0, key: options.getItemKey(0), start: 0 }] : [],
          measureElement: () => undefined,
          scrollToIndex: () => undefined,
          scrollToOffset: () => undefined,
        };
      },
    },
    "lucide-react": { MapPin: "MapPin" },
    react,
    "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
  });

  return {
    getVirtualizerOptions: () => virtualizerOptions.at(-1),
    render: (props) => {
      callbackCursor = 0;
      memoCursor = 0;
      refCursor = 0;
      stateCursor = 0;
      return PickupPointCombobox(props);
    },
  };
}

function createPickupPoint(index) {
  return {
    address: `Адрес ${index}`,
    id: `point-${index}`,
    title: `Пункт ${index}`,
    workHours: "09:00-21:00",
  };
}

function createPickupComboboxProps(overrides = {}) {
  return {
    datasetIdentity: "ozon:44",
    emptyText: "ПВЗ не найден",
    isOpen: true,
    isPending: false,
    label: "Пункт выдачи Ozon",
    onOpenChange: () => undefined,
    onQueryChange: () => undefined,
    onSelect: () => undefined,
    pickupPoints: [createPickupPoint(0)],
    placeholder: "Адрес или название ПВЗ",
    query: "",
    triggerLabel: "Выберите пункт выдачи",
    ...overrides,
  };
}

async function renderOzonSelector({
  drafts,
  cityDetails,
  pickupPoints = [],
  pickupState = {},
  onCityDetails,
  onPickupPoints,
} = {}) {
  const source = await readSource(
    "src/features/checkout/ui/delivery-selector/delivery-selector.tsx",
  );
  const jsx = (type, props, key) => ({ key, props, type });
  const component = (name) => name;
  const { DeliverySelector } = evaluateTypeScript(source, {
    "../../lib": {
      clearCdekDraftCity: (value) => value,
      clearOzonDraftCity: (value) => ({ ...value, ozon: {} }),
      filterPickupPoints: (points) => points,
      formatPickupPointCount: (count) => `${count} ПВЗ`,
      selectDraftCity: (value) => value,
      selectDraftPickupPoint: (value) => value,
      selectOzonDraftCity: (value, city) => ({
        ...value,
        ozon: { city, cityCode: city.code },
      }),
    },
    "../../model": {
      useCdekCities: () => ({
        cities: [],
        isError: false,
        isFetching: false,
        isPending: false,
        retry: () => undefined,
      }),
      useCdekCity: (cityCode, enabled) => {
        onCityDetails?.({ cityCode, enabled });
        return {
          city: cityCode === cityDetails?.code ? cityDetails : undefined,
          isError: false,
          isFetching: false,
          isPending: Boolean(cityCode) && !cityDetails,
          retry: () => undefined,
        };
      },
      useCdekPickupPoints: () => ({
        isError: false,
        isPending: false,
        pickupPoints: [],
      }),
      useOzonPickupPoints: (cityCode, enabled) => {
        onPickupPoints?.({ cityCode, enabled });
        return {
          hasData: enabled,
          isError: false,
          isFetching: false,
          isPending: false,
          pickupPoints: enabled ? pickupPoints : [],
          retry: () => undefined,
          ...pickupState,
        };
      },
    },
    "./combobox-field": { ComboboxField: component("ComboboxField") },
    "./combobox-option": { ComboboxOption: component("ComboboxOption") },
    "./delivery-company-selector": {
      DeliveryCompanySelector: component("DeliveryCompanySelector"),
    },
    "./delivery-options": { defaultDeliveryCompany: "cdek" },
    "./map-placeholder": { MapPlaceholder: component("MapPlaceholder") },
    "./pickup-point-combobox": { PickupPointCombobox: component("PickupPointCombobox") },
    "./pickup-points-map": { PickupPointsMap: component("PickupPointsMap") },
    "@/shared/lib": { cn: (...classes) => classes.filter(Boolean).join(" ") },
    "@/shared/ui/button": { Button: component("Button") },
    "lucide-react": {
      CheckCircle2: component("CheckCircle2"),
      CircleAlert: component("CircleAlert"),
      LoaderCircle: component("LoaderCircle"),
      MapPin: component("MapPin"),
    },
    react: {
      useEffect: () => undefined,
      useMemo: (factory) => factory(),
      useState: (initialValue) => [initialValue, () => undefined],
    },
    "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
  });

  return DeliverySelector({
    drafts: drafts ?? { cdek: {}, ozon: {} },
    isOzonDeliveryAvailable: true,
    onCompanyChange: () => undefined,
    onDraftChange: () => undefined,
    selectedCompany: "ozon",
  });
}

function findNodes(node, predicate) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => findNodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...findNodes(node.props?.children, predicate)];
}

function getText(node) {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  if (Array.isArray(node)) return node.map(getText).join("");
  return getText(node.props?.children);
}

test("Vaul Dialog and Popover share one FocusScope for nested mobile focus", () => {
  const vaulRequire = createRequire(require.resolve("vaul"));
  const dialogRequire = createRequire(vaulRequire.resolve("@radix-ui/react-dialog"));
  const radixRequire = createRequire(require.resolve("radix-ui"));
  const popoverRequire = createRequire(radixRequire.resolve("@radix-ui/react-popover"));

  assert.equal(
    dialogRequire.resolve("@radix-ui/react-focus-scope"),
    popoverRequire.resolve("@radix-ui/react-focus-scope"),
  );
});

test("checkout combobox traps its portal and keeps a Vaul-safe scrollable list", async () => {
  const source = await readSource("src/features/checkout/ui/delivery-selector/combobox-field.tsx");

  assert.match(source, /<Popover modal open=\{isOpen\}/u);
  assert.match(source, /<PopoverContent data-vaul-no-drag className="flex flex-col p-0">/u);
  assert.match(source, /className="shrink-0 border-b p-2"/u);
  const listClasses = source.match(/className="([^"]*overflow-y-auto[^"]*)"/u)?.[1].split(" ");
  for (const className of ["min-h-0", "max-h-80", "overflow-y-auto", "overscroll-contain", "p-1"]) {
    assert.ok(listClasses?.includes(className), `Missing scrollable list class: ${className}`);
  }
});

test("pickup search indexes all fields once and finds the last item in stable order", async () => {
  const { createPickupPointSearchIndex, searchPickupPointIndex } = await loadDeliverySelectorLib();
  const reads = { address: 0, title: 0, workHours: 0 };
  const points = Array.from({ length: 6_000 }, (_, index) => {
    const values = {
      address: index === 5_999 ? "  Улица Ёлочная  " : `Адрес ${index}`,
      title: index % 2 === 0 ? "Пункт" : "Выдача",
      workHours: "09:00-21:00",
    };

    return {
      id: `point-${index}`,
      get address() {
        reads.address += 1;
        return values.address;
      },
      get title() {
        reads.title += 1;
        return values.title;
      },
      get workHours() {
        reads.workHours += 1;
        return values.workHours;
      },
    };
  });

  assert.equal(typeof createPickupPointSearchIndex, "function");
  assert.equal(typeof searchPickupPointIndex, "function");
  const index = createPickupPointSearchIndex(points);

  assert.deepEqual(reads, { address: 6_000, title: 6_000, workHours: 6_000 });
  assert.equal(searchPickupPointIndex(index, "  ёЛОЧНАЯ ")[0]?.id, "point-5999");
  assert.deepEqual(
    searchPickupPointIndex(index, "пункт")
      .slice(0, 3)
      .map((point) => point.id),
    ["point-0", "point-2", "point-4"],
  );
  assert.equal(searchPickupPointIndex(index, "").length, 6_000);
  assert.deepEqual(reads, { address: 6_000, title: 6_000, workHours: 6_000 });
});

test("pickup selection rejects deferred query and dataset transitions", async () => {
  const { isPickupPointSelectionCurrent } = await loadDeliverySelectorLib();

  assert.equal(typeof isPickupPointSelectionCurrent, "function");
  assert.equal(isPickupPointSelectionCurrent("арб", "арб", "ozon:44", "ozon:44"), true);
  assert.equal(isPickupPointSelectionCurrent("арб", "ар", "ozon:44", "ozon:44"), false);
  assert.equal(isPickupPointSelectionCurrent("арб", "арб", "ozon:137", "ozon:44"), false);
  assert.equal(
    isPickupPointSelectionCurrent("арб", "арб", "ozon:44", "ozon:44", "ар", "ozon:44"),
    false,
  );
  assert.equal(
    isPickupPointSelectionCurrent("арб", "арб", "ozon:44", "ozon:44", "арб", "ozon:137"),
    false,
  );
  const oldPoints = [createPickupPoint(0)];
  const replacementPoints = [createPickupPoint(1)];
  assert.equal(
    isPickupPointSelectionCurrent(
      "арб",
      "арб",
      "ozon:44",
      "ozon:44",
      "арб",
      "ozon:44",
      replacementPoints,
      oldPoints,
      oldPoints,
    ),
    false,
  );
});

test("pickup keyboard navigation reaches offscreen boundaries without unbounded mounting", async () => {
  const { getPickupPointNavigationIndex, includeActivePickupPoint } =
    await loadDeliverySelectorLib();

  assert.equal(typeof getPickupPointNavigationIndex, "function");
  assert.equal(typeof includeActivePickupPoint, "function");
  assert.equal(getPickupPointNavigationIndex(-1, "ArrowDown", 6_000), 0);
  assert.equal(getPickupPointNavigationIndex(0, "End", 6_000), 5_999);
  assert.equal(getPickupPointNavigationIndex(5_999, "ArrowUp", 6_000), 5_998);
  assert.equal(getPickupPointNavigationIndex(5_999, "Home", 6_000), 0);
  assert.deepEqual(includeActivePickupPoint([10, 11, 12], 5_999), [10, 11, 12, 5_999]);
  assert.equal(
    includeActivePickupPoint(
      Array.from({ length: 12 }, (_, index) => index),
      5_999,
    ).length,
    13,
  );
  assert.equal(
    includeActivePickupPoint(
      Array.from({ length: 12 }, (_, index) => index),
      10,
    ).length,
    12,
  );
  assert.deepEqual(includeActivePickupPoint([0, 1], 5_630, 2), [0, 1]);
});

test("pickup virtualizer observes portal late mount and close-reopen callback refs", async () => {
  const harness = await createPickupComboboxHarness();
  const props = createPickupComboboxProps();
  const first = harness.render(props);

  assert.equal(typeof first.props.listRef, "function");
  assert.equal(harness.getVirtualizerOptions().getScrollElement(), null);
  const firstElement = { name: "first-listbox" };
  first.props.listRef(firstElement);
  harness.render(props);
  assert.equal(harness.getVirtualizerOptions().getScrollElement(), firstElement);

  first.props.listRef(null);
  harness.render({ ...props, isOpen: false });
  assert.equal(harness.getVirtualizerOptions().getScrollElement(), null);

  const reopened = harness.render(props);
  const secondElement = { name: "second-listbox" };
  reopened.props.listRef(secondElement);
  harness.render(props);
  assert.equal(harness.getVirtualizerOptions().getScrollElement(), secondElement);
});

test("same-city pickup array replacement blocks stale click and Enter", async () => {
  let deferredSnapshot;
  const harness = await createPickupComboboxHarness({
    deferValue: (value) => (deferredSnapshot ??= value),
  });
  const selected = [];
  const oldPoints = [createPickupPoint(0)];
  const props = createPickupComboboxProps({
    onSelect: (point) => selected.push(point.id),
    pickupPoints: oldPoints,
  });
  let tree = harness.render(props);
  tree.props.onInputKeyDown({
    ctrlKey: false,
    key: "ArrowDown",
    metaKey: false,
    nativeEvent: { isComposing: false },
    preventDefault: () => undefined,
  });
  tree = harness.render(props);

  const replacementProps = { ...props, pickupPoints: [createPickupPoint(1)] };
  tree = harness.render(replacementProps);
  const [staleOption] = findNodes(tree.props.children, (node) => node.type === "ComboboxOption");
  staleOption.props.onSelect();
  tree.props.onInputKeyDown({
    ctrlKey: false,
    key: "Enter",
    keyCode: 13,
    metaKey: false,
    nativeEvent: { isComposing: false },
    preventDefault: () => undefined,
  });

  assert.deepEqual(selected, []);
});

test("shrinking pickup data invalidates active tail and never emits an out-of-range index", async () => {
  const harness = await createPickupComboboxHarness();
  const largeProps = createPickupComboboxProps({
    pickupPoints: Array.from({ length: 5_631 }, (_, index) => createPickupPoint(index)),
  });
  let tree = harness.render(largeProps);
  tree.props.onInputKeyDown({
    ctrlKey: true,
    key: "End",
    metaKey: false,
    nativeEvent: { isComposing: false },
    preventDefault: () => undefined,
  });
  harness.render(largeProps);

  tree = harness.render({
    ...largeProps,
    pickupPoints: [createPickupPoint(0), createPickupPoint(1)],
  });
  const indexes = harness.getVirtualizerOptions().rangeExtractor({
    count: 2,
    endIndex: 1,
    overscan: 5,
    startIndex: 0,
  });

  assert.deepEqual(indexes, [0, 1]);
  assert.equal(tree.props.activeDescendant, undefined);
});

test("pickup virtualizer keeps key and range callbacks stable across equivalent renders", async () => {
  const harness = await createPickupComboboxHarness();
  const props = createPickupComboboxProps();
  harness.render(props);
  const first = harness.getVirtualizerOptions();
  harness.render(props);
  const second = harness.getVirtualizerOptions();

  assert.equal(second.getItemKey, first.getItemKey);
  assert.equal(second.rangeExtractor, first.rangeExtractor);
});

test("pickup combobox ignores navigation and Enter during IME composition", async () => {
  const harness = await createPickupComboboxHarness();
  const selected = [];
  const props = createPickupComboboxProps({ onSelect: (point) => selected.push(point.id) });
  let tree = harness.render(props);
  let prevented = 0;
  tree.props.onInputKeyDown({
    ctrlKey: false,
    key: "ArrowDown",
    keyCode: 229,
    metaKey: false,
    nativeEvent: { isComposing: true },
    preventDefault: () => {
      prevented += 1;
    },
  });
  tree = harness.render(props);
  tree.props.onInputKeyDown({
    ctrlKey: false,
    key: "Enter",
    keyCode: 229,
    metaKey: false,
    nativeEvent: { isComposing: true },
    preventDefault: () => {
      prevented += 1;
    },
  });

  assert.equal(tree.props.activeDescendant, undefined);
  assert.deepEqual(selected, []);
  assert.equal(prevented, 0);
});

test("virtual pickup list exposes its name and full result positions", async () => {
  const harness = await createPickupComboboxHarness();
  const tree = harness.render(
    createPickupComboboxProps({
      pickupPoints: [createPickupPoint(0), createPickupPoint(1), createPickupPoint(2)],
    }),
  );
  const [option] = findNodes(tree.props.children, (node) => node.type === "ComboboxOption");

  assert.equal(tree.props.listboxLabel, "Пункт выдачи Ozon");
  assert.equal(option.props.ariaPosInSet, 1);
  assert.equal(option.props.ariaSetSize, 3);
});

test("pickup map skips fit-key work for Ozon and retains stable CDEK fitting", async () => {
  const { getPickupPointsFitKey } = await loadDeliverySelectorLib();
  const untouchedPoints = new Proxy([], {
    get() {
      throw new Error("fitPoints=false must not inspect pickup points");
    },
  });

  assert.equal(typeof getPickupPointsFitKey, "function");
  assert.equal(getPickupPointsFitKey(false, 55.75, 37.61, untouchedPoints), undefined);
  const points = [
    { id: "b", latitude: 56, longitude: 38 },
    { id: "a", latitude: 55, longitude: 37 },
  ];
  const reordered = [points[1], points[0]];

  assert.equal(
    getPickupPointsFitKey(true, 55.75, 37.61, points),
    getPickupPointsFitKey(true, 55.75, 37.61, reordered),
  );
  assert.notEqual(
    getPickupPointsFitKey(true, 55.75, 37.61, points),
    getPickupPointsFitKey(true, 55.76, 37.61, points),
  );
});

test("pickup combobox virtualizes dynamic rows with stable keys and complete ARIA keyboard wiring", async () => {
  const [source, fieldSource, selectorSource] = await Promise.all([
    readSource("src/features/checkout/ui/delivery-selector/pickup-point-combobox.tsx").catch(
      () => "",
    ),
    readSource("src/features/checkout/ui/delivery-selector/combobox-field.tsx"),
    readSource("src/features/checkout/ui/delivery-selector/delivery-selector.tsx"),
  ]);

  assert.match(source, /useDeferredValue/u);
  assert.match(source, /useVirtualizer\(/u);
  assert.match(source, /measureElement/u);
  assert.match(source, /\n\s+getItemKey,/u);
  assert.match(source, /\n\s+rangeExtractor,/u);
  assert.match(source, /useFlushSync:\s*false/u);
  assert.match(source, /scrollToIndex/u);
  assert.match(fieldSource, /aria-activedescendant/u);
  assert.match(fieldSource, /role=\{listboxId \? "listbox"/u);
  assert.match(source, /role="option"/u);
  assert.match(source, /event\.(ctrlKey|metaKey)/u);
  assert.doesNotMatch(selectorSource, /filtered(?:Cdek|Ozon)PickupPoints\.map/u);
  assert.doesNotMatch(selectorSource, /\.slice\(0,\s*(?:80|100)\)/u);
  assert.equal(selectorSource.match(/<PickupPointCombobox/gu)?.length, 2);
});

test("Ozon does not request or render pickup points before an exact city is ready", async () => {
  const detailCalls = [];
  const pickupCalls = [];
  const tree = await renderOzonSelector({
    onCityDetails: (value) => detailCalls.push(value),
    onPickupPoints: (value) => pickupCalls.push(value),
  });
  const [pickupField] = findNodes(
    tree,
    (node) => node.type === "PickupPointCombobox" && node.props?.label === "Пункт выдачи Ozon",
  );
  const [placeholder] = findNodes(tree, (node) => node.type === "MapPlaceholder");

  assert.deepEqual(detailCalls, [{ cityCode: undefined, enabled: true }]);
  assert.deepEqual(pickupCalls, [{ cityCode: undefined, enabled: false }]);
  assert.equal(findNodes(tree, (node) => node.type === "PickupPointsMap").length, 0);
  assert.equal(placeholder.props.title, "Начните с города");
  assert.equal(pickupField.props.disabled, true);
  assert.equal(pickupField.props.emptyText, "Сначала выберите город");
});

test("selected Ozon city renders the full dataset at the exact stable CDEK center", async () => {
  const city = {
    code: 44,
    countryCode: "RU",
    latitude: 55.7558,
    longitude: 37.6176,
    name: "Москва",
    region: "Москва",
  };
  const tree = await renderOzonSelector({
    cityDetails: city,
    drafts: {
      cdek: {},
      ozon: { city: { code: 44, countryCode: "RU", name: "Москва" }, cityCode: 44 },
    },
    pickupPoints: [
      {
        id: "near",
        title: "Near",
        address: "Москва, 1",
        workHours: "09:00-21:00",
        latitude: 55.7,
        longitude: 37.6,
        deliveryPrice: 100,
      },
      {
        id: "far",
        title: "Far",
        address: "Зеленоград, 2",
        workHours: "09:00-21:00",
        latitude: 56,
        longitude: 37.2,
        deliveryPrice: 100,
      },
    ],
  });
  const [map] = findNodes(tree, (node) => node.type === "PickupPointsMap");

  assert.deepEqual(map.props.initialCenter, { lat: city.latitude, long: city.longitude });
  assert.equal(map.props.pickupPoints.length, 2);
  assert.equal(map.props.fitPoints, false);
  assert.equal(map.props.initialZoom, 12);
  assert.equal(map.key, "ozon-city-map-44");
  const source = await readSource(
    "src/features/checkout/ui/delivery-selector/delivery-selector.tsx",
  );
  assert.match(source, /<PickupPointCombobox/u);
  assert.match(source, /pickupPoints=\{ozonPickupPointsState\.pickupPoints\}/u);
  assert.doesNotMatch(source, /pickupPoints=\{filteredOzonPickupPoints\}/u);
});

test("Ozon selector omits positive count and boundary label but preserves status states", async () => {
  const city = {
    code: 44,
    countryCode: "RU",
    latitude: 55.7558,
    longitude: 37.6176,
    name: "Москва",
    region: "Москва",
  };
  const drafts = { cdek: {}, ozon: { city, cityCode: city.code } };
  const loadedTree = await renderOzonSelector({
    cityDetails: city,
    drafts,
    pickupPoints: [{ id: "point", address: "Москва, 1", workHours: "24/7" }],
  });
  const emptyTree = await renderOzonSelector({ cityDetails: city, drafts });
  const loadingTree = await renderOzonSelector({
    cityDetails: city,
    drafts,
    pickupState: { hasData: false, isFetching: true, isPending: true },
  });
  const errorTree = await renderOzonSelector({
    cityDetails: city,
    drafts,
    pickupState: { hasData: false, errorMessage: "Ошибка Ozon", isError: true },
  });
  const source = await readSource(
    "src/features/checkout/ui/delivery-selector/delivery-selector.tsx",
  );
  const mapSource = await readSource(
    "src/features/checkout/ui/delivery-selector/pickup-points-map.tsx",
  );

  assert.doesNotMatch(getText(loadedTree), /Нашли|Поиск работает/u);
  assert.doesNotMatch(source, /Граница города:/u);
  assert.match(getText(emptyTree), /Для этого города пункты Ozon не найдены\./u);
  assert.match(getText(loadingTree), /Загружаем пункты Ozon для выбранного города\./u);
  assert.match(getText(errorTree), /Ошибка Ozon/u);
  assert.match(getText(errorTree), /Повторить загрузку ПВЗ/u);
  assert.match(mapSource, /OpenStreetMap/u);
});

test("Ozon map identity retains camera within one city and changes only with city code", async () => {
  const renderMap = async (code) => {
    const city = {
      code,
      countryCode: "RU",
      latitude: 50 + code / 100,
      longitude: 30 + code / 100,
      name: `Город ${code}`,
      region: "Регион",
    };
    const tree = await renderOzonSelector({
      cityDetails: city,
      drafts: { cdek: {}, ozon: { city, cityCode: code } },
    });
    return findNodes(tree, (node) => node.type === "PickupPointsMap")[0];
  };
  const first = await renderMap(44);
  const same = await renderMap(44);
  const changed = await renderMap(137);

  assert.equal(first.key, same.key);
  assert.notEqual(first.key, changed.key);
});

test("frontend delivery actions request Ozon points by exact CDEK city code", async () => {
  const source = await readSource("src/shared/actions/delivery/delivery.actions.ts");

  assert.match(source, /\/delivery\/cdek\/city\?cityCode=/u);
  assert.match(source, /delivery\/ozon\/pickup-points\?cityCode=/u);
  assert.doesNotMatch(source, /localityId/u);
});

test("map markers and zoom controls keep 44px interactive targets", async () => {
  const [map, styles] = await Promise.all([
    readSource("src/features/checkout/ui/delivery-selector/pickup-points-map.tsx"),
    readSource("src/features/checkout/ui/delivery-selector/pickup-points-map.module.css"),
  ]);

  assert.equal(map.match(/iconSize: \[44, 44\]/gu)?.length, 2);
  assert.match(styles, /\.markerShell\s*\{[^}]*height:\s*44px;[^}]*width:\s*44px;/su);
  assert.match(styles, /leaflet-control-zoom[^}]*min-height:\s*44px;[^}]*min-width:\s*44px;/su);
});
