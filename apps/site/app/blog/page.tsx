import { BlogDataBuilder } from "@/features/blog";
import { BlogPage } from "@/pages/blog";

import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

export { metadata } from "@/pages/blog/metadata";

export default async function Page() {
  const { queryClient } = await new BlogDataBuilder().withPosts().build();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BlogPage />
    </HydrationBoundary>
  );
}
