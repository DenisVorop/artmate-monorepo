import { createAnalytics, createDiagnosticCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  recoveryRequested: () => createDiagnosticCommand("account_recovery_requested", {}),
});

export function useAnalytics() {
  return {
    recoveryRequested: () => analytics.send("recoveryRequested"),
  };
}
