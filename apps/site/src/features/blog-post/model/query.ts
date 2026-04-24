import { queryOptions } from "@tanstack/react-query";

import { getBlogPostPageData } from "@/shared/actions/blog";

export const blogPostPageQuery = (slug: string) =>
  queryOptions({
    queryKey: ["blog", "post-page", slug] as const,
    queryFn: () => getBlogPostPageData(slug),
    staleTime: Infinity,
  });
