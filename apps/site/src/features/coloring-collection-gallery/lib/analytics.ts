import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  collectionOpened: (collectionSlug: string, viewKey: string) =>
    createGoalCommand(
      "digital_versions_opened",
      { collection_slug: collectionSlug },
      { scope: "memory", entityKey: viewKey },
    ),
});

const galleryAnalytics = {
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
