import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

export const contactFormAnalytics = createAnalytics({
  sent: () => createGoalCommand("feedback_submit_success", { form: "contact" }),
});
