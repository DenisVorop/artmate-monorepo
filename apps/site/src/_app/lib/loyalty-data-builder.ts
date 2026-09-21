import { loyaltyQuery } from "@/entities/loyalty";
import { getQueryClient } from "@/shared/lib/query-client";

export class LoyaltyDataBuilder {
  async build(userId: string) {
    const queryClient = getQueryClient();
    await queryClient.prefetchQuery(loyaltyQuery.overview(userId));
    const overview = queryClient.getQueryData(loyaltyQuery.overview(userId).queryKey);
    if (overview?.member?.status === "active" && overview.member.historyState === "ready") {
      await Promise.all([
        queryClient.prefetchQuery(loyaltyQuery.dashboard(userId)),
        queryClient.prefetchQuery(loyaltyQuery.operations(userId)),
      ]);
    }
    return { queryClient };
  }
}
