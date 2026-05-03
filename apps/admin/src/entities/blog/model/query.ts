import { queryOptions } from "@tanstack/react-query";

import {
  getAdminBlogPost,
  getAdminBlogPosts,
  getBlogAuthors,
  getBlogCategories,
  getBlogTags,
} from "@/shared/actions/blog";

const adminBlogStaleTimeMs = 1000 * 60 * 5;

export const blogQueryKeys = {
  all: ["admin-blog"] as const,
  authors: () => [...blogQueryKeys.all, "authors"] as const,
  categories: () => [...blogQueryKeys.all, "categories"] as const,
  detail: (postId: string) =>
    [...blogQueryKeys.all, "detail", postId] as const,
  list: () => [...blogQueryKeys.all, "list"] as const,
  tags: () => [...blogQueryKeys.all, "tags"] as const,
};

export const blogQuery = {
  authors: () =>
    queryOptions({
      queryKey: blogQueryKeys.authors(),
      queryFn: getBlogAuthors,
      staleTime: adminBlogStaleTimeMs,
      retryOnMount: false,
    }),
  categories: () =>
    queryOptions({
      queryKey: blogQueryKeys.categories(),
      queryFn: getBlogCategories,
      staleTime: adminBlogStaleTimeMs,
      retryOnMount: false,
    }),
  detail: (postId: string) =>
    queryOptions({
      queryKey: blogQueryKeys.detail(postId),
      queryFn: () => getAdminBlogPost(postId),
      staleTime: adminBlogStaleTimeMs,
      retryOnMount: false,
    }),
  list: () =>
    queryOptions({
      queryKey: blogQueryKeys.list(),
      queryFn: getAdminBlogPosts,
      staleTime: adminBlogStaleTimeMs,
      retryOnMount: false,
    }),
  tags: () =>
    queryOptions({
      queryKey: blogQueryKeys.tags(),
      queryFn: getBlogTags,
      staleTime: adminBlogStaleTimeMs,
      retryOnMount: false,
    }),
};
