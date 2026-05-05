import { HomeDataBuilder } from "@/app/lib/home-data-builder";
import { HomePage } from "@/pages/home";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { createPageMetadata, Seo } from "@/shared/lib/seo";
import { HydrationBoundary } from "@tanstack/react-query";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.home,
    fallback: createPageMetadata("home"),
  });
}

export default async function Page() {
  const { queryClient } = await new HomeDataBuilder().withProducts().build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <HomePage />
    </HydrationBoundary>
  );
}
