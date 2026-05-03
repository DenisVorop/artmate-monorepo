"use client";

import { useMutation } from "@tanstack/react-query";

import { createBlogAuthor } from "@/shared/actions/blog";

import type { MutationOptions } from "./mutation-options";

export function useCreateBlogAuthor({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать автора",
      successMessage: "Автор создан",
    },
    mutationFn: createBlogAuthor,
    onSuccess,
  });

  return { isPending, mutate };
}
