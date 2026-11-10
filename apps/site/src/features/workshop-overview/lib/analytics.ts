import { createAnalytics, createInteractionCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  retried: () => createInteractionCommand("workshop_retry", {}),
  collectionOpened: () => createInteractionCommand("workshop_collection_open", {}),
  addOpened: () => createInteractionCommand("workshop_add_collection_open", {}),
  addDismissed: () => createInteractionCommand("workshop_add_collection_dismiss", {}),
  collectionSelected: () => createInteractionCommand("workshop_add_collection_select", {}),
  addRequested: () => createInteractionCommand("workshop_add_collection_request", {}),
  collectionAdded: () => createInteractionCommand("workshop_add_collection_success", {}),
  addFailed: () => createInteractionCommand("workshop_add_collection_error", {}),
  publicWorkshopOpened: () => createInteractionCommand("workshop_public_open", {}),
  visibilityOpened: () => createInteractionCommand("workshop_visibility_open", {}),
  visibilityDismissed: () => createInteractionCommand("workshop_visibility_dismiss", {}),
  visibilityRequested: () => createInteractionCommand("workshop_visibility_request", {}),
  madePublic: () => createInteractionCommand("workshop_visibility_public", {}),
  madePrivate: () => createInteractionCommand("workshop_visibility_private", {}),
  visibilityFailed: () => createInteractionCommand("workshop_visibility_error", {}),
});

const actions = {
  retried: () => analytics.send("retried"),
  collectionOpened: () => analytics.send("collectionOpened"),
  addOpened: () => analytics.send("addOpened"),
  addDismissed: () => analytics.send("addDismissed"),
  collectionSelected: () => analytics.send("collectionSelected"),
  addRequested: () => analytics.send("addRequested"),
  collectionAdded: () => analytics.send("collectionAdded"),
  addFailed: () => analytics.send("addFailed"),
  publicWorkshopOpened: () => analytics.send("publicWorkshopOpened"),
  visibilityOpened: () => analytics.send("visibilityOpened"),
  visibilityDismissed: () => analytics.send("visibilityDismissed"),
  visibilityRequested: () => analytics.send("visibilityRequested"),
  madePublic: () => analytics.send("madePublic"),
  madePrivate: () => analytics.send("madePrivate"),
  visibilityFailed: () => analytics.send("visibilityFailed"),
};

export function useAnalytics() {
  return actions;
}
