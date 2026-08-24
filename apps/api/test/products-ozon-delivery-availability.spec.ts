import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ProductStatus } from "../src/generated/prisma/client";
import { ProductsService } from "../src/products/products.service";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("Products Ozon delivery availability", () => {
  it("requires every requested product to allow Ozon delivery", async () => {
    const countCalls: unknown[] = [];
    const counts = [2, 1];
    const prisma = {
      product: {
        count: async (args: unknown) => {
          countCalls.push(args);
          return counts.shift() ?? 0;
        },
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    const allAvailable = await service.areProductsOzonDeliveryAvailable([
      "a",
      "a",
      "",
      "b",
    ]);
    const someUnavailable = await service.areProductsOzonDeliveryAvailable([
      "a",
      "b",
      "b",
    ]);
    const emptySelection = await service.areProductsOzonDeliveryAvailable([]);

    assert.deepEqual(countCalls, [
      {
        where: {
          id: { in: ["a", "b"] },
          isOzonDeliveryAvailable: true,
        },
      },
      {
        where: {
          id: { in: ["a", "b"] },
          isOzonDeliveryAvailable: true,
        },
      },
    ]);
    assert.equal(allAvailable, true);
    assert.equal(someUnavailable, false);
    assert.equal(emptySelection, false);
  });

  it("writes true by default and preserves an explicit false", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const prisma = {
      product: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          writes.push(data);
          return createStoredProduct(Boolean(data.isOzonDeliveryAvailable));
        },
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);
    const baseInput = {
      currency: "RUB" as const,
      priceRub: 1000,
      slug: "forest",
      title: "Лес",
    };

    const defaultProduct = await service.createProduct(baseInput);
    const disabledProduct = await service.createProduct({
      ...baseInput,
      isOzonDeliveryAvailable: false,
      slug: "forest-disabled",
    });

    assert.equal(writes[0]?.isOzonDeliveryAvailable, true);
    assert.equal(writes[1]?.isOzonDeliveryAvailable, false);
    assert.equal(defaultProduct.isOzonDeliveryAvailable, true);
    assert.equal(disabledProduct.isOzonDeliveryAvailable, false);
  });

  it("preserves an explicit false when updating a product", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const prisma = {
      product: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          writes.push(data);
          return createStoredProduct(Boolean(data.isOzonDeliveryAvailable));
        },
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    const updatedProduct = await service.updateProduct("product-true", {
      isOzonDeliveryAvailable: false,
    });

    assert.deepEqual(writes, [{ isOzonDeliveryAvailable: false }]);
    assert.equal(updatedProduct.isOzonDeliveryAvailable, false);
  });
});

function createStoredProduct(isOzonDeliveryAvailable: boolean) {
  const now = new Date("2026-08-23T12:00:00.000Z");

  return {
    id: `product-${isOzonDeliveryAvailable}`,
    slug: `product-${isOzonDeliveryAvailable}`,
    title: "Лес",
    description: null,
    status: ProductStatus.DRAFT,
    isHit: false,
    isOutOfStock: false,
    isOzonDeliveryAvailable,
    categoryId: null,
    category: null,
    price: 100_000,
    currency: "RUB",
    createdAt: now,
    updatedAt: now,
    images: [],
    tags: [],
  };
}
