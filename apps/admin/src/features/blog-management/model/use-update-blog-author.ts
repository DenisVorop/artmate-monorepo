"use client";

import { useMutation } from "@tanstack/react-query";

import {
  updateBlogAuthor,
  type UpdateBlogAuthorInputDTO,
} from "@/shared/actions/blog";

import type { MutationOptions } from "./mutation-options";

type UpdateBlogAuthorVariables = {
  readonly authorId: string;
  readonly input: UpdateBlogAuthorInputDTO;
};

export function useUpdateBlogAuthor({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить автора",
      successMessage: "Автор сохранен",
    },
    mutationFn: ({ authorId, input }: UpdateBlogAuthorVariables) =>
      updateBlogAuthor(authorId, input),
    onSuccess,
  });

  return { isPending, mutate };
}
