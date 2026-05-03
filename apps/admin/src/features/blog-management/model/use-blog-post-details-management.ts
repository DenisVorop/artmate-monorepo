"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import {
  blogQueryKeys,
  useBlogAuthors,
  useBlogCategories,
  useBlogPost,
  useBlogTags,
} from "@/entities/blog";
import { routes } from "@/shared/constants";

export function useBlogPostDetailsManagement(postId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    isError: isPostError,
    isPending: isPostPending,
    post,
    refetch: refetchPost,
  } = useBlogPost(postId);
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

  const refreshBlogPostView = useCallback(async () => {
    await Promise.all([
      refetchAuthors(),
      refetchCategories(),
      refetchPost(),
      refetchTags(),
      queryClient.invalidateQueries({
        queryKey: blogQueryKeys.list(),
      }),
    ]);
  }, [
    queryClient,
    refetchAuthors,
    refetchCategories,
    refetchPost,
    refetchTags,
  ]);

  const handleBlogPostDeleted = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: blogQueryKeys.list(),
    });
    queryClient.removeQueries({
      queryKey: blogQueryKeys.detail(postId),
    });
    router.push(routes.blog);
  }, [postId, queryClient, router]);

  return {
    authors,
    categories,
    handleBlogPostDeleted,
    isError: isPostError || isAuthorsError || isCategoriesError || isTagsError,
    isPending:
      isPostPending || isAuthorsPending || isCategoriesPending || isTagsPending,
    post,
    refreshBlogPostView,
    tags,
  };
}
