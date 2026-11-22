import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PrizesDataBuilder } from "@/app/lib/prizes-data-builder";
import { prizesQuery } from "@/entities/prize";
import { PrizesPage } from "@/pages/prizes";
import { getAuthSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
export const metadata: Metadata = {
  title: "Выбор приза — Мои призы",
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ prizeId: string }> }) {
  const { prizeId } = await params;
  const session = ApiResult.fromDTO(await getAuthSession()).data;
  if (!session?.user)
    redirect(`${routes.auth}?next=${encodeURIComponent(routes.prizeAlbums(prizeId))}`);
  const { queryClient } = await new PrizesDataBuilder().withPrize(session.user.id, prizeId).build();
  const prize = queryClient.getQueryData(prizesQuery.detail(session.user.id, prizeId).queryKey);
  if (prize === null) notFound();
  if (prize?.orderId) redirect(routes.accountOrders);
  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <PrizesPage view="albums" prizeId={prizeId} />
    </HydrationBoundary>
  );
}
