import { getBlogPosts } from "@/shared/actions/blog";
import { ensureApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import { queryOptions } from "@tanstack/react-query";

import type { BlogPostsData } from "./types";

export type BlogPostsResult = ApiResultDTO<BlogPostsData>;

const baseKey = "blog";

export const blogQuery = {
  baseKey: [baseKey],
  getPosts: () =>
    queryOptions({
      queryKey: [baseKey, "posts"] as const,
      queryFn: async () => ensureApiResult(await getBlogPosts()),
      staleTime: Infinity,
    }),
};
