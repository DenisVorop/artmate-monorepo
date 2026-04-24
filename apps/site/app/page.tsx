import { HomeDataBuilder } from "@/app/lib/home-data-builder";
import { HomePage } from "@/pages/home";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

export { metadata } from "@/pages/home/metadata";

export default async function Page() {
  const { queryClient } = await new HomeDataBuilder()
    .withHomeData()
    .withProducts()
    .withReviews()
    .build();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomePage />
    </HydrationBoundary>
  );
}
