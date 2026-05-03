"use client";

import { useQuery } from "@tanstack/react-query";

import { blogQuery } from "./query";

export function useBlogPosts() {
  const { data, isError, isPending, refetch } = useQuery(blogQuery.list());

  return {
    isError,
    isPending,
    posts: data ?? [],
    refetch,
  };
}
