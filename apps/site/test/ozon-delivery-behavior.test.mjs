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

async function renderOzonSelector({
  drafts,
  cityDetails,
  pickupPoints = [],
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
          isError: false,
          isFetching: false,
          isPending: false,
          pickupPoints: enabled ? pickupPoints : [],
          retry: () => undefined,
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

test("Ozon does not request or render pickup points before an exact city is ready", async () => {
  const detailCalls = [];
  const pickupCalls = [];
  const tree = await renderOzonSelector({
    onCityDetails: (value) => detailCalls.push(value),
    onPickupPoints: (value) => pickupCalls.push(value),
  });
  const [pickupField] = findNodes(
    tree,
    (node) => node.type === "ComboboxField" && node.props?.label === "Пункт выдачи Ozon",
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
  assert.match(source, /filteredOzonPickupPoints\.map/u);
  assert.match(source, /pickupPoints=\{ozonPickupPointsState\.pickupPoints\}/u);
  assert.doesNotMatch(source, /pickupPoints=\{filteredOzonPickupPoints\}/u);
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
