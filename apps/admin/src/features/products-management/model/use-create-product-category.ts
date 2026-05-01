"use client";

import { useMutation } from "@tanstack/react-query";

import { createProductCategory } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

export function useCreateProductCategory({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    mutationFn: createProductCategory,
    onSuccess,
  });

  return { isPending, mutate };
}
