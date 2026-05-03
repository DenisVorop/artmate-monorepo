"use client";

import { useMutation } from "@tanstack/react-query";

import { createBlogPost } from "@/shared/actions/blog";

import type { MutationOptions } from "./mutation-options";

export function useCreateBlogPost({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать пост",
      successMessage: "Пост создан",
    },
    mutationFn: createBlogPost,
    onSuccess,
  });

  return { isPending, mutate };
}
