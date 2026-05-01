"use client";

import { useMutation } from "@tanstack/react-query";

import { deleteProductCategory } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

export function useDeleteProductCategory({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    mutationFn: deleteProductCategory,
    onSuccess,
  });

  return { isPending, mutate };
}
