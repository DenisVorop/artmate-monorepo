import { HomeDataBuilder } from "@/app/lib/home-data-builder";
import { HomePage } from "@/pages/home";
import { HomeCommunity, homeCommunityCollectionSlugs } from "@/features/home-community";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { createPageMetadata, Seo } from "@/shared/lib/seo";
import { HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

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
      <HomePage
        communityWorks={
          <Suspense fallback={null}>
            <HomeCommunityData />
          </Suspense>
        }
      />
    </HydrationBoundary>
  );
}

async function HomeCommunityData() {
  const { queryClient } = await new HomeDataBuilder()
    .withCommunityWorks(homeCommunityCollectionSlugs)
    .build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <HomeCommunity />
    </HydrationBoundary>
  );
}
