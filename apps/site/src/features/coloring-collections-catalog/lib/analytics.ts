import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  retried: () => createGoalCommand("digital_catalog_retry", {}),
  collectionClicked: (collectionSlug: string) =>
    createGoalCommand("digital_collection_link_click", { source: "digital", collection_slug: collectionSlug }),
  coverViewed: (collectionSlug: string) =>
    createGoalCommand("digital_collection_cover_view", { collection_slug: collectionSlug }),
  catalogOpened: (viewKey: string) =>
    createGoalCommand("digital_versions_opened", {}, { scope: "memory", entityKey: viewKey }),
});

const catalogAnalytics = {
  retried: () => analytics.send("retried"),
  collectionClicked: (slug: string) => analytics.send("collectionClicked", slug),
  coverViewed: (slug: string) => analytics.send("coverViewed", slug),
  opened(viewKey: string) {
    if (viewKey.trim()) {
      analytics.send("catalogOpened", viewKey);
    }
  },
};

export function useAnalytics() {
  return catalogAnalytics;
}
