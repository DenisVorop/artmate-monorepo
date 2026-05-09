"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { featureBannersQueryKeys } from "@/entities/feature-banners";
import {
  createFeatureBanner,
  type CreateFeatureBannerInputDTO,
} from "@/shared/actions/feature-banners";

export function useCreateFeatureBanner() {
  const queryClient = useQueryClient();
  const { isPending, mutateAsync: mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать баннер",
      successMessage: "Баннер создан",
    },
    mutationFn: (input: CreateFeatureBannerInputDTO) =>
      createFeatureBanner(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: featureBannersQueryKeys.all }),
  });

  return { isPending, mutate };
}
