import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { CatalogLandingsService } from "../src/catalog-landings/catalog-landings.service";
import { ProductStatus } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { ProductDTO } from "../src/products/dto/product.dto";

describe("CatalogLandingsService", () => {
  it("includes Ozon availability and product-specific content in mapped landing products", () => {
    const service = new CatalogLandingsService({} as PrismaService);
    const mapProduct = (
      service as unknown as {
        mapProduct(product: unknown): Record<string, unknown>;
      }
    ).mapProduct.bind(service);

    const mapped = mapProduct({
      id: "product-1",
      slug: "fantasy-coloring",
      title: "Fantasy coloring",
      description: null,
      characteristics: [
        {
          id: "characteristic-1",
          productId: "product-1",
          sortOrder: 0,
          name: "Количество цветов",
          value: "168",
          isHighlighted: true,
        },
      ],
      usageInstructions: "Встряхните маркер.",
      status: ProductStatus.PUBLISHED,
      isHit: false,
      isOutOfStock: false,
      isOzonDeliveryAvailable: false,
      categoryId: null,
      category: null,
      price: 10_000,
      currency: "RUB",
      images: [],
      tags: [],
      createdAt: new Date("2026-08-29T00:00:00.000Z"),
      updatedAt: new Date("2026-08-29T00:00:00.000Z"),
    });

    assert.equal(mapped.isOzonDeliveryAvailable, false);
    assert.deepEqual(mapped.characteristics, [
      { name: "Количество цветов", value: "168", isHighlighted: true },
    ]);
    assert.equal(mapped.usageInstructions, "Встряхните маркер.");
    assert.deepEqual(validateSync(plainToInstance(ProductDTO, mapped)), []);
  });
});
