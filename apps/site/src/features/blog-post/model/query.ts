import { queryOptions } from "@tanstack/react-query";

import { getBlogPostPageData, type BlogPostPageDataDTO } from "@/shared/actions/blog";

const initialData: BlogPostPageDataDTO = {
  post: undefined,
  content: undefined,
  relatedPosts: [],
};

export const blogPostPageQuery = (slug: string) =>
  queryOptions({
    queryKey: ["blog", "post-page", slug] as const,
    queryFn: () => getBlogPostPageData(slug),
    initialData,
    staleTime: Infinity,
  });
