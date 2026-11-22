import {
  createAnalytics,
  createInteractionCommand,
  type InteractionEventParams,
} from "@/shared/lib/analytics";
const registry = createAnalytics({
  pickupProviderChanged: (
    value: InteractionEventParams["pickup_provider_change"]["delivery_provider"],
  ) => createInteractionCommand("pickup_provider_change", { delivery_provider: value }),
  pickupCitySelected: () => createInteractionCommand("pickup_city_select", {}),
  pickupPointSelectedFromList: () => createInteractionCommand("pickup_point_list_select", {}),
  pickupPointSelectedFromMap: () => createInteractionCommand("pickup_point_map_select", {}),
  pickupCityOpened: () => createInteractionCommand("pickup_city_open", {}),
  pickupCityClosed: () => createInteractionCommand("pickup_city_close", {}),
  pickupListOpened: () => createInteractionCommand("pickup_list_open", {}),
  pickupListClosed: () => createInteractionCommand("pickup_list_close", {}),
  pickupCitiesRetried: () => createInteractionCommand("pickup_cities_retry", {}),
  pickupPointsRetried: () => createInteractionCommand("pickup_points_retry", {}),
  pickupCityRetried: () => createInteractionCommand("pickup_city_retry", {}),
});
export function useAnalytics() {
  return {
    pickupCitySelected: () => registry.send("pickupCitySelected"),
    pickupPointSelectedFromList: () => registry.send("pickupPointSelectedFromList"),
    pickupPointSelectedFromMap: () => registry.send("pickupPointSelectedFromMap"),
    pickupCityOpened: () => registry.send("pickupCityOpened"),
    pickupCityClosed: () => registry.send("pickupCityClosed"),
    pickupListOpened: () => registry.send("pickupListOpened"),
    pickupListClosed: () => registry.send("pickupListClosed"),
    pickupCitiesRetried: () => registry.send("pickupCitiesRetried"),
    pickupPointsRetried: () => registry.send("pickupPointsRetried"),
    pickupCityRetried: () => registry.send("pickupCityRetried"),
    pickupProviderChanged: (
      provider: InteractionEventParams["pickup_provider_change"]["delivery_provider"],
    ) => registry.send("pickupProviderChanged", provider),
  };
}
