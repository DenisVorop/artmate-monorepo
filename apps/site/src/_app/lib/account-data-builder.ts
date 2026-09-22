import { achievementQuery } from "@/entities/achievement";
import { loyaltyQuery } from "@/entities/loyalty";
import { ordersQuery } from "@/entities/orders";
import { workshopQuery } from "@/entities/workshop";
import { getQueryClient } from "@/shared/lib/query-client";

export class AccountDataBuilder {
  async build(userId: string, mode: "overview" | "orders" | "achievements") {
    const queryClient = getQueryClient();
    await Promise.all([
      mode !== "achievements"
        ? queryClient.prefetchQuery(ordersQuery.getMyOrders(userId, mode === "overview" ? 3 : 11))
        : Promise.resolve(),
      mode === "overview"
        ? queryClient.prefetchQuery(loyaltyQuery.overview(userId))
        : Promise.resolve(),
      mode !== "orders"
        ? queryClient.prefetchQuery(achievementQuery.list(userId))
        : Promise.resolve(),
      mode === "overview"
        ? queryClient.prefetchQuery(workshopQuery.preview(userId))
        : Promise.resolve(),
    ]);
    const overview = queryClient.getQueryData(loyaltyQuery.overview(userId).queryKey);
    if (
      mode === "overview" &&
      overview?.member?.status === "active" &&
      overview.member.historyState === "ready"
    ) {
      await queryClient.prefetchQuery(loyaltyQuery.dashboard(userId));
    }
    return queryClient;
  }
}
