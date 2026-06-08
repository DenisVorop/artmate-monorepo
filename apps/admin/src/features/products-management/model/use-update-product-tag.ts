"use client";

import { useMutation } from "@tanstack/react-query";

import { updateProductTag, type UpdateProductTagInputDTO } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

type UpdateProductTagVariables = {
  readonly input: UpdateProductTagInputDTO;
  readonly tagId: string;
};

export function useUpdateProductTag({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить тег",
      successMessage: "Тег сохранен",
    },
    mutationFn: ({ input, tagId }: UpdateProductTagVariables) => updateProductTag(tagId, input),
    onSuccess,
  });

  return { isPending, mutate };
}
