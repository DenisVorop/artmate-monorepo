import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { ordersQuery } from "@/entities/orders";
import { OrdersPage } from "@/pages/orders";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export { metadata } from "@/pages/orders/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.orders)}`);
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(ordersQuery.board());

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <OrdersPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
