import type { Metadata } from "next";
import { HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { communityWorkQuery } from "@/entities/community-work";
import { ColoringPalettePreviewPage } from "@/pages/coloring-palette-preview";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

export const metadata: Metadata = {
  title: "Выбор палитры — макет Artmate",
  robots: { index: false, follow: false },
};

export default function Page() {
  const queryClient = new QueryClient();
  // Read-only snapshot of the public endpoint, verified 2026-09-27: no published works for Dogs 1.
  // Keep the prototype offline; do not invent user works or connect production mutations.
  queryClient.setQueryData(
    communityWorkQuery.forColoring("cifrovaya-raskraska-sobachki", 1).queryKey,
    [],
  );

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <ColoringPalettePreviewPage />
    </HydrationBoundary>
  );
}
