import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PrismaService } from "../src/prisma/prisma.service";
import { CartStorage } from "../src/cart/cart.storage";

describe("CartStorage product pricing", () => {
  it("reflects changed and removed sale prices on each cart read", async () => {
    let salePrice: number | null = 7_000;
    const cart = {
      id: "cart-1",
      items: [
        {
          productId: "product-1",
          title: "Product",
          slug: "product",
          price: { toString: () => "100.00" },
          category: null,
          categorySlug: null,
          image: "/product.jpg",
          quantity: 2,
          createdAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      ],
    };
    const prisma = {
      cart: { upsert: async () => cart },
      product: {
        findMany: async () => [{ id: "product-1", price: 10_000, salePrice }],
      },
    } as unknown as PrismaService;
    const storage = new CartStorage(prisma);

    const first = storage.getDTO(await storage.ensureCart("cart-1"));
    assert.equal(first.items[0]?.price, 70);
    assert.equal(first.items[0]?.originalPrice, 100);
    assert.equal(first.subtotal, 140);

    salePrice = 5_500;
    const changed = storage.getDTO(await storage.ensureCart("cart-1"));
    assert.equal(changed.items[0]?.price, 55);
    assert.equal(changed.items[0]?.originalPrice, 100);
    assert.equal(changed.subtotal, 110);

    salePrice = null;
    const removed = storage.getDTO(await storage.ensureCart("cart-1"));
    assert.equal(removed.items[0]?.price, 100);
    assert.equal(removed.items[0]?.originalPrice, undefined);
    assert.equal(removed.subtotal, 200);
  });

  it("keeps the stored snapshot if the product is no longer published", async () => {
    const cart = {
      id: "cart-1",
      items: [
        {
          productId: "product-1",
          title: "Product",
          slug: "product",
          price: { toString: () => "80.00" },
          category: null,
          categorySlug: null,
          image: "/product.jpg",
          quantity: 1,
          createdAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      ],
    };
    const prisma = {
      cart: { upsert: async () => cart },
      product: { findMany: async () => [] },
    } as unknown as PrismaService;
    const storage = new CartStorage(prisma);

    const result = storage.getDTO(await storage.ensureCart("cart-1"));
    assert.equal(result.items[0]?.price, 80);
    assert.equal(result.items[0]?.originalPrice, undefined);
  });
});
