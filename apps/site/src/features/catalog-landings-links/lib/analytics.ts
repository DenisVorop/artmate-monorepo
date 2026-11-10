import {
  createAnalytics,
  createInteractionCommand,
  type InteractionEventParams,
} from "@/shared/lib/analytics";

const analytics = createAnalytics({
  landingOpened: (value: InteractionEventParams["catalog_landing_click"]["landing_slug"]) =>
    createInteractionCommand("catalog_landing_click", { landing_slug: value }),
  listExpanded: () => createInteractionCommand("catalog_landings_expand", {}),
  listCollapsed: () => createInteractionCommand("catalog_landings_collapse", {}),
});

const actions = {
  landingOpened: (value: InteractionEventParams["catalog_landing_click"]["landing_slug"]) =>
    analytics.send("landingOpened", value),
  listExpanded: () => analytics.send("listExpanded"),
  listCollapsed: () => analytics.send("listCollapsed"),
};

export function useAnalytics() {
  return actions;
}
