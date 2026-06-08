"use client";

import { useMutation } from "@tanstack/react-query";

import {
  updateCatalogLandingPage,
  type UpdateCatalogLandingPageInputDTO,
} from "@/shared/actions/catalog-landings";

import type { MutationOptions } from "./mutation-options";

type UpdateCatalogLandingVariables = {
  readonly input: UpdateCatalogLandingPageInputDTO;
  readonly landingId: string;
};

export function useUpdateCatalogLanding({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить подборку",
      successMessage: "Подборка сохранена",
    },
    mutationFn: ({ input, landingId }: UpdateCatalogLandingVariables) =>
      updateCatalogLandingPage(landingId, input),
    onSuccess,
  });

  return { isPending, mutate };
}
