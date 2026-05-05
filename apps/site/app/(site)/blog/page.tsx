import { BlogDataBuilder } from "@/app/lib/blog-data-builder";
import { BlogPage } from "@/pages/blog";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { createPageMetadata } from "@/shared/lib/seo";

import { HydrationBoundary } from "@tanstack/react-query";

export const metadata = createPageMetadata("blog");

export default async function Page() {
  const { queryClient } = await new BlogDataBuilder().withPosts().build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <BlogPage />
    </HydrationBoundary>
  );
}
