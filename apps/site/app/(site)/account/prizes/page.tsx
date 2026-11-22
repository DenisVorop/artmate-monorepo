import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PrizesDataBuilder } from "@/app/lib/prizes-data-builder";
import { PrizesPage } from "@/pages/prizes";
import { getAuthSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
export const metadata: Metadata = { title: "Мои призы", robots: { index: false, follow: false } };
export default async function Page() {
  const session = ApiResult.fromDTO(await getAuthSession()).data;
  if (!session?.user) redirect(`${routes.auth}?next=${encodeURIComponent(routes.accountPrizes)}`);
  const { queryClient } = await new PrizesDataBuilder().withList(session.user.id).build();
  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <PrizesPage />
    </HydrationBoundary>
  );
}
