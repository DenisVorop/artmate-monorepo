import type { Cart, CartItem } from "@/entities/cart";
import type { Product } from "@/entities/products";
import type {
  AddCartItemInputDTO,
  RemoveCartItemInputDTO,
  UpdateCartItemInputDTO,
} from "@/shared/actions/cart";
import {
  createAnalytics,
  createEcommerceCommand,
  createGoalCommand,
  mapAnalyticsProduct,
  type AnalyticsProduct,
} from "@/shared/lib/analytics";

export type ProductListPlacement =
  | "best_sellers"
  | "catalog"
  | "catalog_search_suggestions"
  | "catalog_landing"
  | "related_products";

type CartSnapshot = Cart | null | undefined;
type TrackableProduct = Pick<Product, "category" | "id" | "price" | "title">;

const analytics = createAnalytics({
  productClicked: (product: AnalyticsProduct) =>
    createEcommerceCommand("click", { products: [product] }),
  cartItemAdded: (product: AnalyticsProduct) => [
    createEcommerceCommand("add", { products: [product] }),
    createGoalCommand("add_to_cart", {
      product_id: product.id,
      ...(product.category ? { category: product.category } : {}),
      price: product.price,
      quantity: product.quantity,
      currency: "RUB",
    }),
  ],
  cartQuantityIncreased: (product: AnalyticsProduct) =>
    createEcommerceCommand("add", { products: [product] }),
  cartQuantityDecreased: (product: AnalyticsProduct) =>
    createEcommerceCommand("remove", { products: [product] }),
  cartCleared: (products: readonly AnalyticsProduct[]) =>
    createEcommerceCommand("remove", { products }),
});

const cartAnalytics = {
  productClicked(product: Product, placement: { list: ProductListPlacement; position?: number }) {
    const analyticsProduct = toAnalyticsProduct(product, {
      list: placement.list,
      position: placement.position,
      quantity: 1,
    });

    if (analyticsProduct) {
      analytics.send("productClicked", analyticsProduct);
    }
  },

  cartItemAdded(cart: CartSnapshot, input: AddCartItemInputDTO, previousCart: CartSnapshot) {
    const currentItem = findCartItem(cart, input.productId);
    const requestedQuantity = input.quantity ?? 1;

    if (previousCart === undefined || !currentItem || !isPositiveInteger(requestedQuantity)) {
      return;
    }

    const previousItem = findCartItem(previousCart, input.productId);
    const addedQuantity = currentItem.quantity - (previousItem?.quantity ?? 0);

    const analyticsProduct = toAnalyticsProduct(currentItem, { quantity: addedQuantity });

    if (analyticsProduct) {
      analytics.send("cartItemAdded", analyticsProduct);
    }
  },

  cartItemQuantityUpdated(
    cart: CartSnapshot,
    input: UpdateCartItemInputDTO,
    previousCart: CartSnapshot,
  ) {
    const previousItem = findCartItem(previousCart, input.productId);
    const currentItem = findCartItem(cart, input.productId);

    if (!cart || !previousItem || !currentItem) {
      return;
    }

    const quantityDelta = currentItem.quantity - previousItem.quantity;
    const analyticsProduct = toAnalyticsProduct(currentItem, {
      quantity: Math.abs(quantityDelta),
    });

    if (!analyticsProduct) {
      return;
    }

    analytics.send(
      quantityDelta > 0 ? "cartQuantityIncreased" : "cartQuantityDecreased",
      analyticsProduct,
    );
  },

  cartItemRemoved(cart: CartSnapshot, input: RemoveCartItemInputDTO, previousCart: CartSnapshot) {
    const previousItem = findCartItem(previousCart, input.productId);

    if (!previousItem || !cart) {
      return;
    }

    const currentQuantity = findCartItem(cart, input.productId)?.quantity ?? 0;
    const removedQuantity = previousItem.quantity - currentQuantity;
    const analyticsProduct = toAnalyticsProduct(previousItem, { quantity: removedQuantity });

    if (analyticsProduct) {
      analytics.send("cartQuantityDecreased", analyticsProduct);
    }
  },

  cartCleared(cart: CartSnapshot, previousCart: CartSnapshot) {
    if (!cart || !previousCart) {
      return;
    }

    const removedProducts = previousCart.items.flatMap((previousItem) => {
      const currentQuantity = findCartItem(cart, previousItem.id)?.quantity ?? 0;
      const analyticsProduct = toAnalyticsProduct(previousItem, {
        quantity: previousItem.quantity - currentQuantity,
      });

      return analyticsProduct ? [analyticsProduct] : [];
    });

    if (removedProducts.length > 0) {
      analytics.send("cartCleared", removedProducts);
    }
  },
};

export function useAnalytics() {
  return cartAnalytics;
}

function findCartItem(cart: CartSnapshot, productId: string) {
  return cart?.items.find((item) => item.id === productId);
}

function toAnalyticsProduct(
  product: TrackableProduct | CartItem,
  options: {
    list?: string;
    position?: number;
    quantity: number;
  },
) {
  return mapAnalyticsProduct({
    id: product.id,
    name: product.title,
    price: product.price,
    category: product.category,
    quantity: options.quantity,
    list: options.list,
    position: options.position,
  });
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}
