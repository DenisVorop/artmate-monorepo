"use client";

import { useQuery } from "@tanstack/react-query";

import { blogQuery } from "./query";

export function useBlogAuthors() {
  const { data, isError, isPending, refetch } = useQuery(blogQuery.authors());

  return {
    authors: data ?? [],
    isError,
    isPending,
    refetch,
  };
}
