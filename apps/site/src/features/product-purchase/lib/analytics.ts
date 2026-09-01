import { createAnalytics, createDiagnosticCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  digitalOpened: (productId: string, collectionSlug: string) =>
    createDiagnosticCommand("digital_open_from_product", {
      product_id: productId,
      collection_slug: collectionSlug,
    }),
});

const productPurchaseAnalytics = {
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
