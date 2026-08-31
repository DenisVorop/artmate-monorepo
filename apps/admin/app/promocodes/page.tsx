import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { promoCodesQuery } from "@/entities/promocodes";
import { PromoCodesPage } from "@/pages/promocodes";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = { title: "Промокоды - Artmate Admin" };

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.promoCodes)}`);
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(promoCodesQuery.list());

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <PromoCodesPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
