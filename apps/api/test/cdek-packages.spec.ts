import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { CdekClientService } from "../src/delivery/providers/cdek/cdek-client.service";
import { CdekDeliveryProvider } from "../src/delivery/providers/cdek/cdek-delivery.provider";
import { buildCdekPackages } from "../src/delivery/providers/cdek/cdek-packages";
import type {
  DeliveryCartItem,
  DeliveryShipmentOrder,
} from "../src/delivery/providers/delivery-provider.interface";
import type { ShippingPackageSnapshot } from "../src/products/shipping-package-profile";

const albumSnapshot: ShippingPackageSnapshot = {
  version: 1,
  id: "album-profile",
  code: "coloring-album",
  weightGrams: 400,
  lengthCm: 40,
  widthCm: 30,
  heightCm: 1,
};
const markersSnapshot: ShippingPackageSnapshot = {
  version: 1,
  id: "markers-profile",
  code: "markers-168",
  weightGrams: 2600,
  lengthCm: 31,
  widthCm: 16,
  heightCm: 11,
};
const albumDimensions = { height: 1, length: 40, weight: 400, width: 30 };
const markersDimensions = { height: 11, length: 31, weight: 2600, width: 16 };
const selection = {
  provider: "cdek" as const,
  cityCode: 44,
  pickupPointId: "PVZ-1",
};
const envNames = [
  "CDEK_DEFAULT_ITEM_WEIGHT_GRAMS",
  "CDEK_DEFAULT_PACKAGE_LENGTH_CM",
  "CDEK_DEFAULT_PACKAGE_WIDTH_CM",
  "CDEK_DEFAULT_PACKAGE_HEIGHT_CM",
  "CDEK_SHIPMENT_POINT_CODE",
] as const;
let savedEnv: Record<(typeof envNames)[number], string | undefined>;

type Package = {
  height: number;
  length: number;
  weight: number;
  width: number;
  items?: unknown[];
  number?: string;
};

function createProvider() {
  const requests: Array<{ path: string; body?: { packages: Package[] } }> = [];
  const client = {
    request: async (
      path: string,
      options: { body?: { packages: Package[] } } = {},
    ) => {
      requests.push({ path, body: options.body });
      if (path === "/v2/deliverypoints") {
        return [
          {
            code: "PVZ-1",
            name: "Пункт выдачи",
            work_time: "09:00-21:00",
            location: { address_full: "Москва, ул. Пушкина, 1" },
          },
        ];
      }
      return path === "/v2/orders"
        ? { requests: [{ state: "ACCEPTED" }] }
        : { total_sum: 321 };
    },
  } as unknown as CdekClientService;
  return { provider: new CdekDeliveryProvider(client), requests };
}

function item(
  shippingPackage: ShippingPackageSnapshot,
  quantity: number,
): DeliveryCartItem {
  const album = shippingPackage.code === albumSnapshot.code;
  return {
    id: album ? "album" : "markers",
    slug: album ? "album" : "markers",
    title: album ? "Альбом" : "Набор маркеров 168 шт.",
    price: 79900,
    quantity,
    lineTotal: 79900 * quantity,
    shippingPackage: { ...shippingPackage },
  };
}

function order(items: DeliveryCartItem[]): DeliveryShipmentOrder {
  return {
    id: "order-1",
    customer: {
      email: "buyer@example.com",
      name: "Анна Иванова",
      phone: "+7 (999) 123-45-67",
    },
    delivery: {
      provider: "cdek",
      pickupPoint: {
        id: "PVZ-1",
        title: "Пункт",
        address: "Москва",
        workHours: "09:00-21:00",
        deliveryPrice: 321,
      },
    },
    items,
  };
}

describe("CDEK packages from shipping snapshots", () => {
  beforeEach(() => {
    savedEnv = Object.fromEntries(
      envNames.map((name) => [name, process.env[name]]),
    ) as typeof savedEnv;
    for (const name of envNames) delete process.env[name];
    process.env.CDEK_SHIPMENT_POINT_CODE = "MSK-1";
  });

  afterEach(() => {
    for (const name of envNames) {
      if (savedEnv[name] === undefined) delete process.env[name];
      else process.env[name] = savedEnv[name];
    }
  });

  const cases = [
    {
      name: "one 168-marker set",
      items: [item(markersSnapshot, 1)],
      expected: [markersDimensions],
    },
    {
      name: "two 168-marker sets",
      items: [item(markersSnapshot, 2)],
      expected: [markersDimensions, markersDimensions],
    },
    {
      name: "two albums and one marker set",
      items: [item(albumSnapshot, 2), item(markersSnapshot, 1)],
      expected: [albumDimensions, albumDimensions, markersDimensions],
    },
  ];

  for (const scenario of cases) {
    it(`uses matching calculator and shipment packages for ${scenario.name}`, async () => {
      const { provider, requests } = createProvider();
      await provider.calculatePickupPointDelivery({
        items: scenario.items,
        selection,
      });
      await provider.createOrder(order(scenario.items));
      const calculator = requests.find(
        ({ path }) => path === "/v2/calculator/tariff",
      )?.body;
      const shipment = requests.find(({ path }) => path === "/v2/orders")?.body;
      assert.deepEqual(calculator?.packages, scenario.expected);
      assert.ok(shipment);
      const expandedItems = scenario.items.flatMap((entry) =>
        Array.from({ length: entry.quantity }, () => entry),
      );
      assert.deepEqual(
        shipment.packages,
        scenario.expected.map((dimensions, index) => ({
          ...dimensions,
          items: [
            {
              amount: 1,
              cost: 0,
              name: expandedItems[index]!.title,
              payment: { value: 0, vat_rate: null },
              ware_key: expandedItems[index]!.slug,
              weight: dimensions.weight,
            },
          ],
          number: `order-1-${index + 1}`,
        })),
      );
    });
  }

  it("ignores environment changes between calculation and shipment", async () => {
    const { provider, requests } = createProvider();
    const items = [item(albumSnapshot, 1), item(markersSnapshot, 1)];
    await provider.calculatePickupPointDelivery({ items, selection });
    Object.assign(process.env, {
      CDEK_DEFAULT_ITEM_WEIGHT_GRAMS: "777",
      CDEK_DEFAULT_PACKAGE_LENGTH_CM: "41",
      CDEK_DEFAULT_PACKAGE_WIDTH_CM: "31",
      CDEK_DEFAULT_PACKAGE_HEIGHT_CM: "2",
    });
    await provider.createOrder(order(items));
    const packages = requests.find(({ path }) => path === "/v2/orders")?.body
      ?.packages;
    assert.deepEqual(
      packages?.map(({ height, length, weight, width }) => ({
        height,
        length,
        weight,
        width,
      })),
      [albumDimensions, markersDimensions],
    );
  });

  const invalidCases: Array<{ name: string; items: DeliveryCartItem[] }> = [
    { name: "empty cart", items: [] },
    ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER].map((quantity) => ({
      name: `invalid quantity ${quantity}`,
      items: [item(albumSnapshot, quantity)],
    })),
    {
      name: "package count 256",
      items: [item(albumSnapshot, 255), item(markersSnapshot, 1)],
    },
    {
      name: "missing snapshot",
      items: [{ ...item(albumSnapshot, 1), shippingPackage: undefined }],
    },
    ...[
      { version: 2 },
      { weightGrams: 0 },
      { lengthCm: -1 },
      { widthCm: 1.5 },
      { heightCm: NaN },
      { heightCm: "1" },
      { code: "" },
      { id: "" },
    ].map((override) => ({
      name: `invalid snapshot ${JSON.stringify(override)}`,
      items: [
        {
          ...item(albumSnapshot, 1),
          shippingPackage: {
            ...albumSnapshot,
            ...override,
          } as ShippingPackageSnapshot,
        },
      ],
    })),
  ];

  for (const scenario of invalidCases) {
    it(`rejects ${scenario.name} before pickup or carrier HTTP`, async () => {
      const { provider, requests } = createProvider();
      await assert.rejects(
        provider.calculatePickupPointDelivery({
          items: scenario.items,
          selection,
        }),
      );
      await assert.rejects(provider.createOrder(order(scenario.items)));
      assert.deepEqual(requests, []);
    });
  }

  it("accepts 255 units and captures copied dimension values", () => {
    const entry = item(albumSnapshot, 255);
    const packages = buildCdekPackages([entry]);
    entry.shippingPackage!.weightGrams = 999;
    assert.equal(packages.length, 255);
    assert.equal(packages[0]!.item, entry);
    assert.equal(packages[0]!.weight, 400);
  });
});
