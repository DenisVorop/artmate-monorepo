"use client";

import { useMutation } from "@tanstack/react-query";

import {
  updateBlogCategory,
  type UpdateBlogCategoryInputDTO,
} from "@/shared/actions/blog";

import type { MutationOptions } from "./mutation-options";

type UpdateBlogCategoryVariables = {
  readonly categoryId: string;
  readonly input: UpdateBlogCategoryInputDTO;
};

export function useUpdateBlogCategory({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить категорию",
      successMessage: "Категория сохранена",
    },
    mutationFn: ({ categoryId, input }: UpdateBlogCategoryVariables) =>
      updateBlogCategory(categoryId, input),
    onSuccess,
  });

  return { isPending, mutate };
}
