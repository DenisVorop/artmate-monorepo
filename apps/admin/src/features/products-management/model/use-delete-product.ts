"use client";

import { useMutation } from "@tanstack/react-query";

import { deleteProduct } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

export function useDeleteProduct({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    mutationFn: deleteProduct,
    onSuccess,
  });

  return { isPending, mutate };
}
