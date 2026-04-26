import { BlogDataBuilder } from "@/app/lib/blog-data-builder";
import { BlogPage } from "@/pages/blog";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

import { HydrationBoundary } from "@tanstack/react-query";

export { metadata } from "@/pages/blog/metadata";

export default async function Page() {
  const { queryClient } = await new BlogDataBuilder().withPosts().build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <BlogPage />
    </HydrationBoundary>
  );
}
