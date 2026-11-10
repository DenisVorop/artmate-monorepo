import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  digitalCatalogClicked: (source: "header" | "mobile_menu") =>
    createGoalCommand("digital_catalog_link_click", { source }),
});

export function useAnalytics(source: "header" | "mobile_menu") {
  return { digitalCatalogClicked: () => analytics.send("digitalCatalogClicked", source) };
}
