import { createAnalytics, createInteractionCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  grantRequested: () => createInteractionCommand("account_email_subscribe_request", {}),
  granted: () => createInteractionCommand("account_email_subscribe_success", {}),
  grantFailed: () => createInteractionCommand("account_email_subscribe_error", {}),
  revokeRequested: () => createInteractionCommand("account_email_unsubscribe_request", {}),
  revoked: () => createInteractionCommand("account_email_unsubscribe_success", {}),
  revokeFailed: () => createInteractionCommand("account_email_unsubscribe_error", {}),
  retried: () => createInteractionCommand("account_email_settings_retry", {}),
});

const actions = {
  grantRequested: () => analytics.send("grantRequested"),
  granted: () => analytics.send("granted"),
  grantFailed: () => analytics.send("grantFailed"),
  revokeRequested: () => analytics.send("revokeRequested"),
  revoked: () => analytics.send("revoked"),
  revokeFailed: () => analytics.send("revokeFailed"),
  retried: () => analytics.send("retried"),
};

export function useAnalytics() {
  return actions;
}
