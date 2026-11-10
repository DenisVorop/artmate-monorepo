import { createAnalytics, createInteractionCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  allOpened: () => createInteractionCommand("account_achievements_open", {}),
  filterChanged: () => createInteractionCommand("account_achievements_filter", {}),
});

const actions = {
  allOpened: () => analytics.send("allOpened"),
  filterChanged: () => analytics.send("filterChanged"),
};

export function useAnalytics() {
  return actions;
}
