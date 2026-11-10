import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  digitalCollectionClicked: (slug: string) =>
    createGoalCommand("digital_collection_link_click", { source: "home", collection_slug: slug }),
});

export function useAnalytics() {
  return {
    digitalCollectionClicked: (slug: string) => analytics.send("digitalCollectionClicked", slug),
  };
}
