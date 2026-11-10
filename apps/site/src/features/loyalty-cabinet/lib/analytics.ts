import { createAnalytics, createInteractionCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  loginRequested: () => createInteractionCommand("club_login_request", {}),
  accountOpened: () => createInteractionCommand("club_account_open", {}),
  workshopOpened: () => createInteractionCommand("club_workshop_open", {}),
  operationsPrevious: () => createInteractionCommand("club_operations_previous", {}),
  operationsNext: () => createInteractionCommand("club_operations_next", {}),
  termsOpened: () => createInteractionCommand("club_terms_open", {}),
  enrollRequested: () => createInteractionCommand("club_enroll_request", {}),
  enrolled: () => createInteractionCommand("club_enroll_success", {}),
  enrollFailed: () => createInteractionCommand("club_enroll_error", {}),
});

const actions = {
  loginRequested: () => analytics.send("loginRequested"),
  accountOpened: () => analytics.send("accountOpened"),
  workshopOpened: () => analytics.send("workshopOpened"),
  operationsPrevious: () => analytics.send("operationsPrevious"),
  operationsNext: () => analytics.send("operationsNext"),
  termsOpened: () => analytics.send("termsOpened"),
  enrollRequested: () => analytics.send("enrollRequested"),
  enrolled: () => analytics.send("enrolled"),
  enrollFailed: () => analytics.send("enrollFailed"),
};

export function useAnalytics() {
  return actions;
}
