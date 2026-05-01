"use client";

import { useMutation } from "@tanstack/react-query";

import {
  updateProductCategory,
  type UpdateProductCategoryInputDTO,
} from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

type UpdateProductCategoryVariables = {
  readonly categoryId: string;
  readonly input: UpdateProductCategoryInputDTO;
};

export function useUpdateProductCategory({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить категорию",
      successMessage: "Категория сохранена",
    },
    mutationFn: ({ categoryId, input }: UpdateProductCategoryVariables) =>
      updateProductCategory(categoryId, input),
    onSuccess,
  });

  return { isPending, mutate };
}
