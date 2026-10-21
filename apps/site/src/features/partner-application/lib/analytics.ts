import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

export type PartnerProgramEvent =
  | "partner_cta_click"
  | "partner_form_error"
  | "partner_form_start"
  | "partner_form_success";

const analytics = createAnalytics({
  partnerEvent: (event: PartnerProgramEvent) => createGoalCommand(event, {}),
});

export function trackPartnerProgramEvent(eventName: PartnerProgramEvent) {
  analytics.send("partnerEvent", eventName);
}
