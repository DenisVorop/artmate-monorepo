"use client";

import { useCallback } from "react";

import {
  useBlogAuthors,
  useBlogCategories,
  useBlogPosts,
  useBlogTags,
} from "@/entities/blog";

export function useBlogManagement() {
  const {
    isError: isPostsError,
    isPending: isPostsPending,
    posts,
    refetch: refetchPosts,
  } = useBlogPosts();
  const {
    authors,
    isError: isAuthorsError,
    isPending: isAuthorsPending,
    refetch: refetchAuthors,
  } = useBlogAuthors();
  const {
    categories,
    isError: isCategoriesError,
    isPending: isCategoriesPending,
    refetch: refetchCategories,
  } = useBlogCategories();
  const {
    isError: isTagsError,
    isPending: isTagsPending,
    refetch: refetchTags,
    tags,
  } = useBlogTags();

  const refreshBlogView = useCallback(async () => {
    await Promise.all([
      refetchAuthors(),
      refetchCategories(),
      refetchPosts(),
      refetchTags(),
    ]);
  }, [refetchAuthors, refetchCategories, refetchPosts, refetchTags]);

  return {
    authors,
    categories,
    isError:
      isPostsError || isAuthorsError || isCategoriesError || isTagsError,
    isPending:
      isPostsPending ||
      isAuthorsPending ||
      isCategoriesPending ||
      isTagsPending,
    posts,
    refreshBlogView,
    tags,
  };
}
