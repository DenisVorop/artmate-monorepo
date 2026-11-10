import { createAnalytics, createInteractionCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  retried: () => createInteractionCommand("workshop_collection_retry", {}),
  backOpened: () => createInteractionCommand("workshop_collection_back", {}),
  editorOpened: () => createInteractionCommand("workshop_editor_open", {}),
  publicWorkOpened: () => createInteractionCommand("workshop_public_work_open", {}),
  publishOpened: () => createInteractionCommand("workshop_publish_open", {}),
  unpublishOpened: () => createInteractionCommand("workshop_unpublish_open", {}),
  deleteOpened: () => createInteractionCommand("workshop_delete_open", {}),
  publishDismissed: () => createInteractionCommand("workshop_publish_dismiss", {}),
  unpublishDismissed: () => createInteractionCommand("workshop_unpublish_dismiss", {}),
  deleteDismissed: () => createInteractionCommand("workshop_delete_dismiss", {}),
  publishRequested: () => createInteractionCommand("workshop_publish_request", {}),
  unpublishRequested: () => createInteractionCommand("workshop_unpublish_request", {}),
  deleteRequested: () => createInteractionCommand("workshop_delete_request", {}),
  published: () => createInteractionCommand("workshop_publish_success", {}),
  unpublished: () => createInteractionCommand("workshop_unpublish_success", {}),
  deleted: () => createInteractionCommand("workshop_delete_success", {}),
  publishFailed: () => createInteractionCommand("workshop_publish_error", {}),
  unpublishFailed: () => createInteractionCommand("workshop_unpublish_error", {}),
  deleteFailed: () => createInteractionCommand("workshop_delete_error", {}),
});

const actions = {
  retried: () => analytics.send("retried"),
  backOpened: () => analytics.send("backOpened"),
  editorOpened: () => analytics.send("editorOpened"),
  publicWorkOpened: () => analytics.send("publicWorkOpened"),
  publishOpened: () => analytics.send("publishOpened"),
  unpublishOpened: () => analytics.send("unpublishOpened"),
  deleteOpened: () => analytics.send("deleteOpened"),
  publishDismissed: () => analytics.send("publishDismissed"),
  unpublishDismissed: () => analytics.send("unpublishDismissed"),
  deleteDismissed: () => analytics.send("deleteDismissed"),
  publishRequested: () => analytics.send("publishRequested"),
  unpublishRequested: () => analytics.send("unpublishRequested"),
  deleteRequested: () => analytics.send("deleteRequested"),
  published: () => analytics.send("published"),
  unpublished: () => analytics.send("unpublished"),
  deleted: () => analytics.send("deleted"),
  publishFailed: () => analytics.send("publishFailed"),
  unpublishFailed: () => analytics.send("unpublishFailed"),
  deleteFailed: () => analytics.send("deleteFailed"),
};

export function useAnalytics() {
  return actions;
}
