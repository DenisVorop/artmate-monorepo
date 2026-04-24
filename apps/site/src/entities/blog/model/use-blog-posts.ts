"use client";

import { useQuery } from "@tanstack/react-query";

import { blogQuery } from "./query";

export function useBlogPosts() {
  const { data, isError } = useQuery(blogQuery.getPosts());

  return { data, isError };
}
