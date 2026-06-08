"use client";

import { useMutation } from "@tanstack/react-query";

import { createCatalogLandingPage } from "@/shared/actions/catalog-landings";

import type { MutationOptions } from "./mutation-options";

export function useCreateCatalogLanding({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать подборку",
      successMessage: "Подборка создана",
    },
    mutationFn: createCatalogLandingPage,
    onSuccess,
  });

  return { isPending, mutate };
}
