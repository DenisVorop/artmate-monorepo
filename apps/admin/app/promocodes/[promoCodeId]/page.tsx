import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { promoCodesQuery } from "@/entities/promocodes";
import { PromoCodeDetailPage } from "@/pages/promo-code-detail";
import { getAdminSession } from "@/shared/actions/auth";
import { isPromoCodeApiError } from "@/shared/actions/promocodes";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = { title: "Промокод - Artmate Admin" };

type PromoCodeRouteProps = {
  params: Promise<{ promoCodeId: string }>;
};

export default async function Page({ params }: PromoCodeRouteProps) {
  const { promoCodeId } = await params;
  const session = await getAdminSession();

  if (!session.user) {
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.promoCode(promoCodeId))}`,
    );
  }

  const queryClient = getQueryClient();

  try {
    await queryClient.fetchQuery(promoCodesQuery.detail(promoCodeId));
  } catch (error) {
    if (isPromoCodeApiError(error, 404)) {
      notFound();
    }

    throw error;
  }

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <PromoCodeDetailPage
        currentUser={session.user}
        promoCodeId={promoCodeId}
      />
    </HydrationBoundary>
  );
}
