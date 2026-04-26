import { HomeDataBuilder } from "@/app/lib/home-data-builder";
import { HomePage } from "@/pages/home";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { HydrationBoundary } from "@tanstack/react-query";

export { metadata } from "@/pages/home/metadata";

export default async function Page() {
  const { queryClient } = await new HomeDataBuilder()
    .withHomeData()
    .withProducts()
    .withReviews()
    .build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <HomePage />
    </HydrationBoundary>
  );
}
