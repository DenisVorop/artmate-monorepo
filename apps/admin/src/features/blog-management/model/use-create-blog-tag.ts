"use client";

import { useMutation } from "@tanstack/react-query";

import { createBlogTag } from "@/shared/actions/blog";

import type { MutationOptions } from "./mutation-options";

export function useCreateBlogTag({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать тег",
      successMessage: "Тег создан",
    },
    mutationFn: createBlogTag,
    onSuccess,
  });

  return { isPending, mutate };
}
