import { getBlogPosts } from "@/shared/actions/blog";
import type { ApiResultDTO } from "@/shared/lib/api-result";

import { queryOptions } from "@tanstack/react-query";

import { emptyBlogPostsData, type BlogPostsData } from "@/entities/blog/model";

export type BlogPostsResult = ApiResultDTO<BlogPostsData>;

const baseKey = "blog";

const initialData: BlogPostsResult = {
  status: "empty",
  data: emptyBlogPostsData,
  isSuccess: false,
  isEmpty: true,
  isError: false,
};

export const blogQuery = {
  baseKey: [baseKey],
  getPosts: () =>
    queryOptions({
      queryKey: [baseKey, "posts"] as const,
      queryFn: () => getBlogPosts(),
      initialData,
      staleTime: Infinity,
    }),
};
