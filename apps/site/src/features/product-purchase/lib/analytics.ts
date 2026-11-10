import {
  createAnalytics,
  createDiagnosticCommand,
  createGoalCommand,
  createInteractionCommand,
} from "@/shared/lib/analytics";

const analytics = createAnalytics({
  cartOpened: (productId: string) =>
    createInteractionCommand("product_cart_open", { product_id: productId }),
  quantityIncreased: (productId: string) =>
    createInteractionCommand("product_quantity_increase", { product_id: productId }),
  quantityDecreased: (productId: string) =>
    createInteractionCommand("product_quantity_decrease", { product_id: productId }),
  digitalOpened: (productId: string, collectionSlug: string) => [
    createDiagnosticCommand("digital_open_from_product", {
      product_id: productId,
      collection_slug: collectionSlug,
    }),
    createGoalCommand("digital_collection_link_click", {
      source: "product",
      collection_slug: collectionSlug,
    }),
  ],
});

const productPurchaseAnalytics = {
  cartOpened: (productId: string) => analytics.send("cartOpened", productId),
  quantityIncreased: (productId: string) => analytics.send("quantityIncreased", productId),
  quantityDecreased: (productId: string) => analytics.send("quantityDecreased", productId),
  digitalOpened(productId: string, collectionSlug: string) {
    const normalizedProductId = productId.trim();
    const normalizedCollectionSlug = collectionSlug.trim();

    if (normalizedProductId && normalizedCollectionSlug) {
      analytics.send("digitalOpened", normalizedProductId, normalizedCollectionSlug);
    }
  },
};

export function useAnalytics() {
  return productPurchaseAnalytics;
}
