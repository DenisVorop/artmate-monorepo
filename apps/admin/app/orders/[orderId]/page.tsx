import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { ordersQuery } from "@/entities/orders";
import { OrderHistoryPage } from "@/pages/order-history";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = {
  title: "История заказа - Artmate Admin",
};

type OrderRouteProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function Page({ params }: OrderRouteProps) {
  const { orderId } = await params;
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.order(orderId))}`);
  }

  const queryClient = getQueryClient();

  await fetchAdminOrderOrNotFound(queryClient, orderId);

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <OrderHistoryPage currentUser={session.user} orderId={orderId} />
    </HydrationBoundary>
  );
}

async function fetchAdminOrderOrNotFound(
  queryClient: ReturnType<typeof getQueryClient>,
  orderId: string,
) {
  try {
    await queryClient.fetchQuery(ordersQuery.detail(orderId));
  } catch (error) {
    if (isOrderNotFoundError(error)) {
      notFound();
    }

    throw error;
  }
}

function isOrderNotFoundError(error: unknown) {
  return error instanceof Error && error.message === "Order not found";
}
