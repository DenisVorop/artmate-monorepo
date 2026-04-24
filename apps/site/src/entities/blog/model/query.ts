import { getBlogPosts } from "@/shared/actions/blog";
import { ApiResult } from "@/shared/lib/api-result";

import { queryOptions } from "@tanstack/react-query";

import type { BlogPostsData } from "./types";

export type BlogPostsResult = BlogPostsData | null;

const baseKey = "blog";

export const blogQuery = {
  baseKey: [baseKey],
  getPosts: () =>
    queryOptions({
      queryKey: [baseKey, "posts"] as const,
      queryFn: async () => ApiResult.fromDTO(await getBlogPosts()).unwrap() ?? null,
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
