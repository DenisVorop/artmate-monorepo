"use client";

import { useQuery } from "@tanstack/react-query";

import { blogQuery } from "./query";

export function useBlogTags() {
  const { data, isError, isPending, refetch } = useQuery(blogQuery.tags());

  return {
    isError,
    isPending,
    refetch,
    tags: data ?? [],
  };
}
