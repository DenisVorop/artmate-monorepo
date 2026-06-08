"use client";

import { useMutation } from "@tanstack/react-query";

import { publishCatalogLandingPage } from "@/shared/actions/catalog-landings";

import type { MutationOptions } from "./mutation-options";

export function usePublishCatalogLanding({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось опубликовать подборку",
      successMessage: "Подборка опубликована",
    },
    mutationFn: publishCatalogLandingPage,
    onSuccess,
  });

  return { isPending, mutate };
}
