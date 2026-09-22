import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountDataBuilder } from "@/app/lib/account-data-builder";
import { AccountOrdersPage } from "@/pages/account-orders";
import { getAuthSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

export const metadata: Metadata = {
  title: "Мои заказы",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const session = ApiResult.fromDTO(await getAuthSession()).data;
  if (!session?.user) redirect(`${routes.auth}?next=${encodeURIComponent(routes.accountOrders)}`);
  const queryClient = await new AccountDataBuilder().build(session.user.id, "orders");
  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <AccountOrdersPage />
    </HydrationBoundary>
  );
}
