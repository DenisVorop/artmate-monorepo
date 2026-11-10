import {
  createAnalytics,
  createInteractionCommand,
  type InteractionEventParams,
} from "@/shared/lib/analytics";

type FilterKind = InteractionEventParams["catalog_filter_remove"]["filter_kind"];

const analytics = createAnalytics({
  searchStarted: () => createInteractionCommand("catalog_search", {}),
  searchCleared: () => createInteractionCommand("catalog_search_clear", {}),
  sortChanged: (value: InteractionEventParams["catalog_sort"]["sort"]) =>
    createInteractionCommand("catalog_sort", { sort: value }),
  sortOpened: () => createInteractionCommand("catalog_sort_open", {}),
  sortClosed: () => createInteractionCommand("catalog_sort_close", {}),
  categoryChanged: (value: InteractionEventParams["catalog_category_select"]["catalog_category"]) =>
    createInteractionCommand("catalog_category_select", { catalog_category: value }),
  categoriesOpened: () => createInteractionCommand("catalog_categories_open", {}),
  categoriesClosed: () => createInteractionCommand("catalog_categories_close", {}),
  filtersOpened: () => createInteractionCommand("catalog_filters_open", {}),
  filtersClosed: () => createInteractionCommand("catalog_filters_close", {}),
  filtersApplied: () => createInteractionCommand("catalog_filters_apply", {}),
  filtersReset: () => createInteractionCommand("catalog_filters_reset", {}),
  tagAdded: () => createInteractionCommand("catalog_tag_add", {}),
  tagRemoved: () => createInteractionCommand("catalog_tag_remove", {}),
  availabilityEnabled: () => createInteractionCommand("catalog_availability_enable", {}),
  availabilityDisabled: () => createInteractionCommand("catalog_availability_disable", {}),
  bestsellersEnabled: () => createInteractionCommand("catalog_bestsellers_enable", {}),
  bestsellersDisabled: () => createInteractionCommand("catalog_bestsellers_disable", {}),
  priceChanged: () => createInteractionCommand("catalog_price_change", {}),
  filterRemoved: (kind: FilterKind) =>
    createInteractionCommand("catalog_filter_remove", { filter_kind: kind }),
  filterGroupOpened: () => createInteractionCommand("catalog_filter_group_open", {}),
  filterGroupClosed: () => createInteractionCommand("catalog_filter_group_close", {}),
});

const actions = {
  searchStarted: () => analytics.send("searchStarted"),
  searchCleared: () => analytics.send("searchCleared"),
  sortChanged: (value: InteractionEventParams["catalog_sort"]["sort"]) =>
    analytics.send("sortChanged", value),
  sortOpened: () => analytics.send("sortOpened"),
  sortClosed: () => analytics.send("sortClosed"),
  categoryChanged: (value: InteractionEventParams["catalog_category_select"]["catalog_category"]) =>
    analytics.send("categoryChanged", value),
  categoriesOpened: () => analytics.send("categoriesOpened"),
  categoriesClosed: () => analytics.send("categoriesClosed"),
  filtersOpened: () => analytics.send("filtersOpened"),
  filtersClosed: () => analytics.send("filtersClosed"),
  filtersApplied: () => analytics.send("filtersApplied"),
  filtersReset: () => analytics.send("filtersReset"),
  tagAdded: () => analytics.send("tagAdded"),
  tagRemoved: () => analytics.send("tagRemoved"),
  availabilityEnabled: () => analytics.send("availabilityEnabled"),
  availabilityDisabled: () => analytics.send("availabilityDisabled"),
  bestsellersEnabled: () => analytics.send("bestsellersEnabled"),
  bestsellersDisabled: () => analytics.send("bestsellersDisabled"),
  priceChanged: () => analytics.send("priceChanged"),
  filterRemoved: (kind: FilterKind) => analytics.send("filterRemoved", kind),
  filterGroupOpened: () => analytics.send("filterGroupOpened"),
  filterGroupClosed: () => analytics.send("filterGroupClosed"),
};

export function useAnalytics() {
  return actions;
}
