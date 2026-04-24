"use client";

import { useQuery } from "@tanstack/react-query";

import { blogPostPageQuery } from "./query";

export function useBlogPostPageData(slug: string) {
  const { data } = useQuery(blogPostPageQuery(slug));

  return {
    post: data?.post,
    content: data?.content,
    relatedPosts: data?.relatedPosts ?? [],
  };
}
