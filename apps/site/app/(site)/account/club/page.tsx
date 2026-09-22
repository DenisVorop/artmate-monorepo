import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoyaltyDataBuilder } from "@/app/lib/loyalty-data-builder";
import { LoyaltyPage } from "@/pages/loyalty";
import { getAuthSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

export const metadata: Metadata = {
  title: "Клуб Artmate — бонусная программа",
  description: "Ваш бонусный баланс, уровень и история операций в клубе Artmate.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const session = ApiResult.fromDTO(await getAuthSession()).data;
  if (!session?.user) redirect(`${routes.auth}?next=${encodeURIComponent(routes.loyalty)}`);
  const { queryClient } = await new LoyaltyDataBuilder().build(session.user.id);
  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <LoyaltyPage />
    </HydrationBoundary>
  );
}
