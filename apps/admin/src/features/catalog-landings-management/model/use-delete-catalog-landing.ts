"use client";

import { useMutation } from "@tanstack/react-query";

import { deleteCatalogLandingPage } from "@/shared/actions/catalog-landings";

import type { MutationOptions } from "./mutation-options";

export function useDeleteCatalogLanding({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось удалить подборку",
      successMessage: "Подборка удалена",
    },
    mutationFn: deleteCatalogLandingPage,
    onSuccess,
  });

  return { isPending, mutate };
}
