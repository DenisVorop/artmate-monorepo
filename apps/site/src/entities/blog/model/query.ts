import { getBlogPosts } from "@/shared/actions/blog";
import type { ApiResultDTO } from "@/shared/lib/api-result";

import { queryOptions } from "@tanstack/react-query";

import type { BlogPostsData } from "@/entities/blog/model";

export type BlogPostsResult = ApiResultDTO<BlogPostsData>;

const baseKey = "blog";

export const blogQuery = {
  baseKey: [baseKey],
  getPosts: () =>
    queryOptions({
      queryKey: [baseKey, "posts"] as const,
      queryFn: () => getBlogPosts(),
      staleTime: Infinity,
    }),
};
