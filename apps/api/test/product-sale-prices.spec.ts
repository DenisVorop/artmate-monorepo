import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import type { PrismaService } from "../src/prisma/prisma.service";
import { Prisma } from "../src/generated/prisma/client";
import { ProductsService } from "../src/products/products.service";
import { CreateProductRequestDTO } from "../src/products/dto/create-product-request.dto";
import { UpdateProductRequestDTO } from "../src/products/dto/update-product-request.dto";
import { getProductPrice } from "../src/products/product-pricing";
import { calculatePromoPricing } from "../src/promocodes/pricing";
import {
  createOrderPricingSnapshot,
  parseOrderPricingSnapshot,
} from "../src/orders/pricing/pricing-snapshot";
import { applyLoyaltyPoints } from "../src/orders/pricing/apply-loyalty-points";

function fixture() {
  let nextSalePrice: number | null | undefined;
  let stored = {
    id: "album",
    slug: "album",
    title: "Альбом",
    price: 79_900,
    salePrice: null as number | null,
    currency: "RUB",
    status: "DRAFT",
    isHit: false,
    isOutOfStock: false,
    isOzonDeliveryAvailable: true,
    description: null,
    usageInstructions: null,
    categoryId: null,
    category: null,
    characteristics: [],
    images: [],
    tags: [],
    coloringCollection: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = {
    product: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        stored = {
          ...stored,
          price: data.price as number,
          salePrice: data.salePrice as number | null,
        };
        return stored;
      },
      findUnique: async () => {
        const read = { ...stored };
        if (nextSalePrice !== undefined) {
          stored = { ...stored, salePrice: nextSalePrice };
          nextSalePrice = undefined;
        }
        return read;
      },
      update: async ({
        data,
        where,
      }: {
        data: Record<string, unknown>;
        where: { price?: number; salePrice?: number | null };
      }) => {
        if (
          where.price !== undefined &&
          (where.price !== stored.price || where.salePrice !== stored.salePrice)
        ) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Concurrent price change",
            { code: "P2025", clientVersion: "test" },
          );
        }
        stored = { ...stored, ...data } as typeof stored;
        return stored;
      },
    },
  } as unknown as PrismaService;
  return {
    service: new ProductsService(prisma),
    stored: () => stored,
    changeDuringNextRead: (salePrice: number | null) => {
      nextSalePrice = salePrice;
    },
  };
}

describe("Product sale prices", () => {
  it("rejects a concurrent price edit without overwriting the newer discount", async () => {
    const { service, stored, changeDuringNextRead } = fixture();
    changeDuringNextRead(69_900);
    await assert.rejects(service.updateProduct("album", { priceRub: 899 }), {
      status: 409,
    });
    assert.equal(stored().price, 79_900);
    assert.equal(stored().salePrice, 69_900);
  });
  it("keeps ordinary prices and stores/clears a separate sale price", async () => {
    const { service, stored } = fixture();
    const created = await service.createProduct({
      title: "Альбом",
      slug: "album",
      priceRub: 799,
      salePriceRub: 699,
    });
    assert.equal(created.price, 79_900);
    assert.equal(created.priceRub, 799);
    assert.equal(created.salePrice, 69_900);
    assert.equal(created.salePriceRub, 699);
    assert.equal(getProductPrice(stored()), 69_900);
    const unchanged = await service.updateProduct("album", {
      title: "Новое название",
    });
    assert.equal(unchanged.salePriceRub, 699);
    const cleared = await service.updateProduct("album", {
      salePriceRub: null,
    });
    assert.equal(cleared.salePriceRub, null);
    assert.equal(getProductPrice(stored()), 79_900);
  });

  it("validates both prices together, including partial ordinary-price updates", async () => {
    const { service, stored } = fixture();
    for (const salePriceRub of [0, -1, 799, 800, 699.5, Infinity, 21_474_837]) {
      await assert.rejects(
        service.createProduct({
          title: "Альбом",
          slug: "album",
          priceRub: 799,
          salePriceRub,
        }),
      );
    }
    await service.updateProduct("album", { salePriceRub: 699 });
    await assert.rejects(service.updateProduct("album", { priceRub: 650 }));
    assert.equal(stored().price, 79_900);
    const changed = await service.updateProduct("album", {
      priceRub: 650,
      salePriceRub: 599,
    });
    assert.equal(changed.priceRub, 650);
    assert.equal(changed.salePriceRub, 599);
  });

  it("rejects non-integer HTTP values and accepts explicit clearing", () => {
    for (const salePriceRub of ["699", 0, -1, 12.5, NaN]) {
      assert.ok(
        validateSync(plainToInstance(UpdateProductRequestDTO, { salePriceRub }))
          .length > 0,
      );
    }
    assert.deepEqual(
      validateSync(
        plainToInstance(UpdateProductRequestDTO, { salePriceRub: null }),
      ),
      [],
    );
    assert.deepEqual(
      validateSync(
        plainToInstance(CreateProductRequestDTO, {
          title: "Альбом",
          slug: "album",
          priceRub: 799,
          salePriceRub: 699,
        }),
      ),
      [],
    );
  });

  it("applies promo then loyalty to the sale price and freezes the order snapshot", () => {
    const product = { price: 79_900, salePrice: 69_900 as number | null };
    const promo = calculatePromoPricing(
      [
        {
          id: "album",
          unitPriceKopecks: getProductPrice(product),
          quantity: 2,
        },
      ],
      { type: "percentage", basisPoints: 1000 },
    );
    const snapshot = applyLoyaltyPoints(
      createOrderPricingSnapshot(promo, 25_000),
      5,
    );
    assert.equal(snapshot.subtotalKopecks, 139_800);
    assert.equal(snapshot.promoDiscountKopecks, 13_980);
    assert.equal(snapshot.loyaltyDiscountKopecks, 100);
    assert.equal(snapshot.totalKopecks, 150_720);
    product.salePrice = null;
    assert.equal(getProductPrice(product), 79_900);
    assert.deepEqual(
      parseOrderPricingSnapshot(JSON.parse(JSON.stringify(snapshot))),
      snapshot,
    );
  });
});
