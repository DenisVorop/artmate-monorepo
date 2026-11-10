import type { Product } from "@/entities/products";
import {
  createAnalytics,
  createEcommerceCommand,
  createGoalCommand,
  createInteractionCommand,
  mapAnalyticsProduct,
  type AnalyticsProduct,
  type YandexGoalParams,
} from "@/shared/lib/analytics";

const analytics = createAnalytics({
  worksRetried: () => createInteractionCommand("product_works_retry", {}),
  galleryOpenedFromWorks: () => createInteractionCommand("product_works_gallery_open", {}),
  wildberriesReviewsOpened: () => createInteractionCommand("product_wildberries_reviews_open", {}),
  ozonReviewsOpened: () => createInteractionCommand("product_ozon_reviews_open", {}),
  characteristicsJumped: () => createInteractionCommand("product_characteristics_jump", {}),
  communityJumped: () => createInteractionCommand("product_community_jump", {}),
  reviewsOpened: () => createInteractionCommand("product_reviews_open", {}),
  instructionsOpened: () => createInteractionCommand("product_instructions_open", {}),
  photoViewed: (params: YandexGoalParams["product_photo_view"]) =>
    createGoalCommand("product_photo_view", params),
  photoSelected: (params: YandexGoalParams["product_photo_select"]) =>
    createGoalCommand("product_photo_select", params),
  galleryOpened: (productId: string, position: number) =>
    createGoalCommand("product_gallery_open", { product_id: productId, position }),
  galleryClosed: (productId: string, position: number) =>
    createGoalCommand("product_gallery_close", { product_id: productId, position }),
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
  worksRetried: () => analytics.send("worksRetried"),
  galleryOpenedFromWorks: () => analytics.send("galleryOpenedFromWorks"),
  wildberriesReviewsOpened: () => analytics.send("wildberriesReviewsOpened"),
  ozonReviewsOpened: () => analytics.send("ozonReviewsOpened"),
  characteristicsJumped: () => analytics.send("characteristicsJumped"),
  communityJumped: () => analytics.send("communityJumped"),
  reviewsOpened: () => analytics.send("reviewsOpened"),
  instructionsOpened: () => analytics.send("instructionsOpened"),
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

export function useGalleryAnalytics(productId: string) {
  type Mode = YandexGoalParams["product_photo_view"]["mode"];
  return {
    photoViewed: (position: number, mode: Mode) =>
      analytics.send("photoViewed", { product_id: productId, position, mode }),
    photoSelected: (position: number, mode: Mode) =>
      analytics.send("photoSelected", { product_id: productId, position, mode }),
    galleryOpened: (position: number) => analytics.send("galleryOpened", productId, position),
    galleryClosed: (position: number) => analytics.send("galleryClosed", productId, position),
  };
}
