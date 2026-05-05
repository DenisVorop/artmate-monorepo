import { BlogDataBuilder } from "@/app/lib/blog-data-builder";
import { BlogPage } from "@/pages/blog";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

import { HydrationBoundary } from "@tanstack/react-query";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.blog,
    fallback: createPageMetadata("blog"),
  });
}

export default async function Page() {
  const { queryClient } = await new BlogDataBuilder().withPosts().build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <BlogPage />
    </HydrationBoundary>
  );
}
