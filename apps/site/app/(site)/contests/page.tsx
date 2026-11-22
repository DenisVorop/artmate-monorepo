import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { ContestsDataBuilder } from "@/app/lib/contests-data-builder";
import { ContestsPage } from "@/pages/contests";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
export const metadata: Metadata = {
  title: "Конкурсы Artmate",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const { queryClient } = await new ContestsDataBuilder().withContests().build();
  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <ContestsPage />
    </HydrationBoundary>
  );
}
