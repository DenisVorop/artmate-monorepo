import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  retried: (slug: string) => createGoalCommand("digital_collection_retry", { collection_slug: slug }),
  printAlbumClicked: (slug: string, productId: string) =>
    createGoalCommand("digital_print_album_click", { collection_slug: slug, product_id: productId }),
  pictureClicked: (collectionSlug: string, number: number) =>
    createGoalCommand("digital_picture_link_click", {
      source: "digital", collection_slug: collectionSlug, coloring_number: number,
    }),
  thumbnailViewed: (collectionSlug: string, number: number) =>
    createGoalCommand("digital_picture_thumbnail_view", {
      collection_slug: collectionSlug, coloring_number: number,
    }),
  collectionOpened: (collectionSlug: string, viewKey: string) =>
    createGoalCommand(
      "digital_versions_opened",
      { collection_slug: collectionSlug },
      { scope: "memory", entityKey: viewKey },
    ),
});

const galleryAnalytics = {
  retried: (slug: string) => analytics.send("retried", slug),
  printAlbumClicked: (slug: string, productId: string) => analytics.send("printAlbumClicked", slug, productId),
  pictureClicked(slug: string, number: number) {
    analytics.send("pictureClicked", slug, number);
  },
  thumbnailViewed(slug: string, number: number) {
    analytics.send("thumbnailViewed", slug, number);
  },
  opened(collectionSlug: string, viewKey: string) {
    const normalizedSlug = collectionSlug.trim();

    if (normalizedSlug && viewKey.trim()) {
      analytics.send("collectionOpened", normalizedSlug, viewKey);
    }
  },
};

export function useAnalytics() {
  return galleryAnalytics;
}
