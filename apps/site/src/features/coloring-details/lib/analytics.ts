import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  coloringOpened: (collectionSlug: string, coloringNumber: number, viewKey: string) =>
    createGoalCommand(
      "digital_coloring_open",
      {
        collection_slug: collectionSlug,
        coloring_number: coloringNumber,
      },
      { scope: "memory", entityKey: viewKey },
    ),
});

const coloringAnalytics = {
  opened(collectionSlug: string, coloringNumber: number, viewKey: string) {
    const normalizedSlug = collectionSlug.trim();

    if (
      normalizedSlug &&
      Number.isInteger(coloringNumber) &&
      coloringNumber > 0 &&
      viewKey.trim()
    ) {
      analytics.send("coloringOpened", normalizedSlug, coloringNumber, viewKey);
    }
  },
};

export function useAnalytics() {
  return coloringAnalytics;
}
