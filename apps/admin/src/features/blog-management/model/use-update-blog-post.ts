"use client";

import { useMutation } from "@tanstack/react-query";

import { updateBlogPost, type UpdateBlogPostInputDTO } from "@/shared/actions/blog";

import type { MutationOptions } from "./mutation-options";

type UpdateBlogPostVariables = {
  readonly input: UpdateBlogPostInputDTO;
  readonly postId: string;
};

export function useUpdateBlogPost({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить пост",
      successMessage: "Пост сохранен",
    },
    mutationFn: ({ input, postId }: UpdateBlogPostVariables) =>
      updateBlogPost(postId, input),
    onSuccess,
  });

  return { isPending, mutate };
}
