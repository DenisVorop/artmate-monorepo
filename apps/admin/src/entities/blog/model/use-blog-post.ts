"use client";

import { useQuery } from "@tanstack/react-query";

import { blogQuery } from "./query";

export function useBlogPost(postId: string) {
  const { data, isError, isPending, refetch } = useQuery(
    blogQuery.detail(postId),
  );

  return {
    isError,
    isPending,
    post: data,
    refetch,
  };
}
