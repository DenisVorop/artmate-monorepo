import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { CdekClientService } from "../src/delivery/providers/cdek/cdek-client.service";
import { CdekDeliveryProvider } from "../src/delivery/providers/cdek/cdek-delivery.provider";

const pickupPointResponse = [
  {
    code: "PVZ-1",
    name: "Пункт выдачи",
    work_time: "09:00-21:00",
    location: { address_full: "Москва, ул. Пушкина, 1" },
  },
];

const defaultDimensionEnvNames = [
  "CDEK_DEFAULT_ITEM_WEIGHT_GRAMS",
  "CDEK_DEFAULT_PACKAGE_LENGTH_CM",
  "CDEK_DEFAULT_PACKAGE_WIDTH_CM",
  "CDEK_DEFAULT_PACKAGE_HEIGHT_CM",
] as const;

let savedDefaultDimensionEnv: Record<
  (typeof defaultDimensionEnvNames)[number],
  string | undefined
>;

function createClient(requests: Array<[string, unknown]>, response: unknown) {
  return {
    request: async (path: string, options: unknown = {}) => {
      requests.push([path, options]);
      return typeof response === "function" ? response(path) : response;
    },
  } as unknown as CdekClientService;
}

function albumItem(quantity: number) {
  return {
    id: "album",
    slug: "album",
    title: "Альбом",
    price: 79900,
    quantity,
    lineTotal: 79900 * quantity,
    shippingPackage: {
      version: 1 as const,
      id: "album-profile",
      code: "coloring-album",
      weightGrams: 400,
      lengthCm: 40,
      widthCm: 30,
      heightCm: 1,
    },
  };
}

describe("CDEK album package baseline", () => {
  beforeEach(() => {
    savedDefaultDimensionEnv = Object.fromEntries(
      defaultDimensionEnvNames.map((name) => [name, process.env[name]]),
    ) as typeof savedDefaultDimensionEnv;
    for (const name of defaultDimensionEnvNames) delete process.env[name];
  });

  afterEach(() => {
    for (const name of defaultDimensionEnvNames) {
      const value = savedDefaultDimensionEnv[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("preserves the confirmed package payload per album quantity", async () => {
    for (const quantity of [1, 3]) {
      const requests: Array<[string, unknown]> = [];
      const provider = new CdekDeliveryProvider(
        createClient(requests, (path: string) =>
          path === "/v2/deliverypoints"
            ? pickupPointResponse
            : { total_sum: 321 },
        ),
      );

      await provider.calculatePickupPointDelivery({
        items: [albumItem(quantity)],
        selection: { provider: "cdek", cityCode: 44, pickupPointId: "PVZ-1" },
      });

      const calculator = requests.find(
        ([path]) => path === "/v2/calculator/tariff",
      );
      assert.ok(calculator);
      const body = (calculator[1] as { body: { packages: unknown[] } }).body;
      assert.deepEqual(
        body.packages,
        Array.from({ length: quantity }, () => ({
          height: 1,
          length: 40,
          weight: 400,
          width: 30,
        })),
      );
    }
  });

  it("ignores obsolete environment overrides for calculator packages", async () => {
    Object.assign(process.env, {
      CDEK_DEFAULT_ITEM_WEIGHT_GRAMS: "777",
      CDEK_DEFAULT_PACKAGE_LENGTH_CM: "41",
      CDEK_DEFAULT_PACKAGE_WIDTH_CM: "31",
      CDEK_DEFAULT_PACKAGE_HEIGHT_CM: "2",
    });
    const requests: Array<[string, unknown]> = [];
    const provider = new CdekDeliveryProvider(
      createClient(requests, (path: string) =>
        path === "/v2/deliverypoints"
          ? pickupPointResponse
          : { total_sum: 321 },
      ),
    );
    await provider.calculatePickupPointDelivery({
      items: [albumItem(1)],
      selection: { provider: "cdek", cityCode: 44, pickupPointId: "PVZ-1" },
    });
    const calculator = requests.find(
      ([path]) => path === "/v2/calculator/tariff",
    );
    assert.deepEqual(
      (calculator?.[1] as { body: { packages: unknown[] } }).body.packages,
      [{ height: 1, length: 40, weight: 400, width: 30 }],
    );
  });

  it("creates one package per album and sends amount one with matching weight and dimensions", async () => {
    const previousShipmentPoint = process.env.CDEK_SHIPMENT_POINT_CODE;
    process.env.CDEK_SHIPMENT_POINT_CODE = "MSK-1";
    const requests: Array<[string, unknown]> = [];
    const provider = new CdekDeliveryProvider(
      createClient(requests, { requests: [{ state: "ACCEPTED" }] }),
    );
    try {
      await provider.createOrder({
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
        items: [albumItem(3)],
      });

      const order = requests.find(([path]) => path === "/v2/orders");
      assert.ok(order);
      const packages = (
        order[1] as { body: { packages: Array<Record<string, unknown>> } }
      ).body.packages;
      assert.equal(packages.length, 3);
      for (const [index, pkg] of packages.entries()) {
        assert.deepEqual(
          {
            height: pkg.height,
            length: pkg.length,
            weight: pkg.weight,
            width: pkg.width,
          },
          { height: 1, length: 40, weight: 400, width: 30 },
        );
        assert.deepEqual(pkg.items, [
          {
            amount: 1,
            cost: 0,
            name: "Альбом",
            payment: { value: 0, vat_rate: null },
            ware_key: "album",
            weight: 400,
          },
        ]);
        assert.equal(pkg.number, `order-1-${index + 1}`);
      }
    } finally {
      if (previousShipmentPoint === undefined)
        delete process.env.CDEK_SHIPMENT_POINT_CODE;
      else process.env.CDEK_SHIPMENT_POINT_CODE = previousShipmentPoint;
    }
  });
});
