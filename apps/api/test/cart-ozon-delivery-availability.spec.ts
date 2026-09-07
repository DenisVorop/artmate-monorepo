import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import type { CartStorage } from "../src/cart/cart.storage";
import { CartService } from "../src/cart/cart.service";
import type { ProductsService } from "../src/products/products.service";

describe("Cart Ozon delivery availability", () => {
  it("includes only the server-owned Ozon minimum delivery price", async () => {
    const cartStorage = {
      ensureCart: async () => ({ id: "cart-1" }),
      getDTO: () => createCartDTO(),
    };
    const productsService = {
      areProductsOzonDeliveryAvailable: async () => true,
    };
    const service = new CartService(
      cartStorage as unknown as CartStorage,
      productsService as unknown as ProductsService,
    );

    const cart = await service.getCart("cart-1");

    assert.deepEqual(cart.minimumDeliveryPrices, { ozon: 100 });
    assert.equal("cdek" in cart.minimumDeliveryPrices, false);
  });

  it("does not declare a made-up CDEK minimum delivery price", async () => {
    const constantsSource = await readFile(
      path.join(__dirname, "../src/delivery/delivery.constants.ts"),
      "utf8",
    );

    assert.doesNotMatch(constantsSource, /cdekDeliveryPriceFromRub/u);
  });

  it("derives availability from current products on every read", async () => {
    let available = true;
    const productIdCalls: (readonly string[])[] = [];
    const storedCart = { id: "cart-1" };
    const cartStorage = {
      ensureCart: async () => storedCart,
      getDTO: () => createCartDTO(),
    };
    const productsService = {
      areProductsOzonDeliveryAvailable: async (
        productIds: readonly string[],
      ) => {
        productIdCalls.push(productIds);
        return available;
      },
    };
    const service = new CartService(
      cartStorage as unknown as CartStorage,
      productsService as unknown as ProductsService,
    );

    const availableCart = await service.getCart("cart-1");
    available = false;
    const unavailableCart = await service.getCart("cart-1");

    assert.equal(getOzonDeliveryAvailability(availableCart), true);
    assert.equal(getOzonDeliveryAvailability(unavailableCart), false);
    assert.deepEqual(productIdCalls, [["product-1"], ["product-1"]]);
  });

  it("keeps an empty cart unavailable without querying products", async () => {
    let availabilityCallCount = 0;
    const cartStorage = {
      ensureCart: async () => ({ id: "cart-1" }),
      getDTO: () => createCartDTO([]),
    };
    const productsService = {
      areProductsOzonDeliveryAvailable: async () => {
        availabilityCallCount += 1;
        return true;
      },
    };
    const service = new CartService(
      cartStorage as unknown as CartStorage,
      productsService as unknown as ProductsService,
    );

    const cart = await service.getCart("cart-1");

    assert.equal(getOzonDeliveryAvailability(cart), false);
    assert.equal(availabilityCallCount, 0);
  });

  it("adds availability to every cart mutation response", async () => {
    const storedCart = { id: "cart-1" };
    const cartStorage = {
      addItem: async () => storedCart,
      clearCart: async () => storedCart,
      getDTO: () => createCartDTO(),
      removeItem: async () => storedCart,
      updateItemQuantity: async () => storedCart,
    };
    const productsService = {
      areProductsOzonDeliveryAvailable: async () => true,
      getCartProductSnapshot: async () => ({
        id: "product-1",
        image: "/product.jpg",
        price: 1_000,
        slug: "product-1",
        title: "Product 1",
      }),
    };
    const service = new CartService(
      cartStorage as unknown as CartStorage,
      productsService as unknown as ProductsService,
    );

    const carts = await Promise.all([
      service.addItem("cart-1", { productId: "product-1" }),
      service.updateItem("cart-1", "product-1", { quantity: 2 }),
      service.removeItem("cart-1", "product-1"),
      service.clearCart("cart-1"),
    ]);

    assert.deepEqual(carts.map(getOzonDeliveryAvailability), [
      true,
      true,
      true,
      true,
    ]);
  });
});

function createCartDTO(items = [createCartItem()]) {
  const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    currency: "RUB" as const,
    id: "cart-1",
    items,
    itemsCount,
    subtotal,
    total: subtotal,
  };
}

function createCartItem() {
  return {
    id: "product-1",
    image: "/product.jpg",
    lineTotal: 1_000,
    price: 1_000,
    quantity: 1,
    slug: "product-1",
    title: "Product 1",
  };
}

function getOzonDeliveryAvailability(cart: object) {
  return "isOzonDeliveryAvailable" in cart
    ? cart.isOzonDeliveryAvailable
    : undefined;
}
