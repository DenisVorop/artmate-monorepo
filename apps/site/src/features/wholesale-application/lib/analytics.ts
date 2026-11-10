import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

export const wholesaleApplicationAnalytics = createAnalytics({
  sent: () => createGoalCommand("feedback_submit_success", { form: "wholesale" }),
});
