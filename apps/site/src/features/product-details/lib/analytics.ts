import type { Product } from "@/entities/products";
import {
  createAnalytics,
  createEcommerceCommand,
  createGoalCommand,
  mapAnalyticsProduct,
  type AnalyticsProduct,
} from "@/shared/lib/analytics";

const analytics = createAnalytics({
  productViewed: (product: AnalyticsProduct, viewKey: string) => [
    createEcommerceCommand(
      "detail",
      { products: [product] },
      { scope: "memory", entityKey: viewKey },
    ),
    createGoalCommand(
      "product_view",
      {
        product_id: product.id,
        ...(product.category ? { category: product.category } : {}),
        price: product.price,
        currency: "RUB",
      },
      { scope: "memory", entityKey: viewKey },
    ),
  ],
});

const productDetailsAnalytics = {
  productViewed(product: Product, viewKey: string) {
    const analyticsProduct = mapAnalyticsProduct({
      id: product.id,
      name: product.title,
      price: product.price,
      category: product.category,
      quantity: 1,
    });

    if (analyticsProduct) {
      analytics.send("productViewed", analyticsProduct, viewKey);
    }
  },
};

export function useAnalytics() {
  return productDetailsAnalytics;
}
