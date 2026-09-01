import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  catalogOpened: (viewKey: string) =>
    createGoalCommand("digital_versions_opened", {}, { scope: "memory", entityKey: viewKey }),
});

const catalogAnalytics = {
  opened(viewKey: string) {
    if (viewKey.trim()) {
      analytics.send("catalogOpened", viewKey);
    }
  },
};

export function useAnalytics() {
  return catalogAnalytics;
}
