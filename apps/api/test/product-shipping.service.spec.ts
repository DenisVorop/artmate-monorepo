import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";

import type { PrismaService } from "../src/prisma/prisma.service";
import { ProductShippingService } from "../src/products/product-shipping.service";
import type { ShippingPackageProfile } from "../src/products/shipping-package-profile";

const album: ShippingPackageProfile = {
  id: "shipping_album",
  code: "album",
  weightGrams: 400,
  lengthCm: 40,
  widthCm: 30,
  heightCm: 1,
};
const markers: ShippingPackageProfile = {
  id: "shipping_markers",
  code: "markers",
  weightGrams: 2600,
  lengthCm: 31,
  widthCm: 16,
  heightCm: 11,
};

function createService(
  rows: Array<{
    id: string;
    shippingPackageProfile: ShippingPackageProfile | null;
  }>,
) {
  const calls: unknown[] = [];
  const prisma = {
    product: {
      findMany: async (query: unknown) => {
        calls.push(query);
        return rows;
      },
    },
  };
  return {
    calls,
    service: new ProductShippingService(prisma as unknown as PrismaService),
  };
}

describe("Product shipping profile resolution", () => {
  it("resolves a mixed cart in one batch, deduplicating product IDs", async () => {
    const { service, calls } = createService([
      { id: "markers-sku", shippingPackageProfile: markers },
      { id: "album-sku", shippingPackageProfile: album },
    ]);
    const result = await service.resolveForProducts([
      "album-sku",
      "markers-sku",
      "album-sku",
    ]);
    assert.deepEqual(
      [...result.entries()],
      [
        ["album-sku", album],
        ["markers-sku", markers],
      ],
    );
    assert.deepEqual(calls, [
      {
        where: { id: { in: ["album-sku", "markers-sku"] } },
        select: {
          id: true,
          shippingPackageProfile: {
            select: {
              id: true,
              code: true,
              weightGrams: true,
              lengthCm: true,
              widthCm: true,
              heightCm: true,
            },
          },
        },
      },
    ]);
  });

  it("does not query products for an empty input", async () => {
    const { service, calls } = createService([]);
    assert.equal((await service.resolveForProducts([])).size, 0);
    assert.deepEqual(calls, []);
  });

  it("reports all unknown products and missing bindings without album fallback", async () => {
    const { service } = createService([
      { id: "album-sku", shippingPackageProfile: album },
      { id: "markers-sku", shippingPackageProfile: null },
    ]);
    await assert.rejects(
      service.resolveForProducts([
        "album-sku",
        "markers-sku",
        "deleted-sku",
        "markers-sku",
      ]),
      (error: unknown) => {
        assert(error instanceof BadRequestException);
        assert.deepEqual(error.getResponse(), {
          code: "SHIPPING_PACKAGE_PROFILE_MISSING",
          message: "Для части товаров не настроена упаковка для доставки СДЭК.",
          productIds: ["markers-sku", "deleted-sku"],
        });
        return true;
      },
    );
  });

  it("rejects invalid stored values rather than silently replacing them", async () => {
    const { service } = createService([
      {
        id: "markers-sku",
        shippingPackageProfile: { ...markers, weightGrams: 0 },
      },
    ]);
    await assert.rejects(
      service.resolveForProducts(["markers-sku"]),
      BadRequestException,
    );
  });

  it("returns independent values for products sharing the same profile", async () => {
    const { service } = createService([
      { id: "album-a", shippingPackageProfile: album },
      { id: "album-b", shippingPackageProfile: album },
    ]);
    const result = await service.resolveForProducts(["album-a", "album-b"]);
    result.get("album-a")!.weightGrams = 1;
    assert.equal(result.get("album-b")!.weightGrams, 400);
    assert.equal(album.weightGrams, 400);
  });

  it("rereads profiles for a new calculation instead of caching in the cart", async () => {
    const stored = { ...markers };
    const { service, calls } = createService([
      { id: "markers-sku", shippingPackageProfile: stored },
    ]);
    const first = await service.resolveForProducts(["markers-sku"]);
    stored.weightGrams = 2700;
    const second = await service.resolveForProducts(["markers-sku"]);
    assert.equal(first.get("markers-sku")!.weightGrams, 2600);
    assert.equal(second.get("markers-sku")!.weightGrams, 2700);
    assert.equal(calls.length, 2);
  });
});
