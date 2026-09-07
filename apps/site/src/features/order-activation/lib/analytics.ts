import { createAnalytics, createDiagnosticCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  activationCompleted: () => createDiagnosticCommand("order_activation_completed", {}),
});

export function useAnalytics() {
  return {
    activationCompleted: () => analytics.send("activationCompleted"),
  };
}
