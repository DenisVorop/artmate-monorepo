"use client";

import { useMutation } from "@tanstack/react-query";

import {
  updateBlogTag,
  type UpdateBlogTagInputDTO,
} from "@/shared/actions/blog";

import type { MutationOptions } from "./mutation-options";

type UpdateBlogTagVariables = {
  readonly input: UpdateBlogTagInputDTO;
  readonly tagId: string;
};

export function useUpdateBlogTag({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить тег",
      successMessage: "Тег сохранен",
    },
    mutationFn: ({ input, tagId }: UpdateBlogTagVariables) =>
      updateBlogTag(tagId, input),
    onSuccess,
  });

  return { isPending, mutate };
}
