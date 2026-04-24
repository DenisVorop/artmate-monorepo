"use client";

import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { blogQuery } from "./query";

function useBlogPostsQuery() {
  return useQuery(blogQuery.getPosts());
}

export function useBlogPosts() {
  const { data } = useBlogPostsQuery();

  const posts = useMemo(() => data?.data?.items ?? [], [data]);
  const categories: string[] = useMemo(
    () => Array.from(new Set(posts.map((post) => post.category))),
    [posts],
  );
  const featuredPost = posts.find((post) => post.featured);

  return {
    posts,
    categories,
    featuredPost,
    isError: data?.isError === true,
    isEmpty: data?.isEmpty === true,
  };
}
