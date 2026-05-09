"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { featureBannersQueryKeys } from "@/entities/feature-banners";
import { archiveFeatureBanner } from "@/shared/actions/feature-banners";

export function useArchiveFeatureBanner() {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось архивировать баннер",
      successMessage: "Баннер архивирован",
    },
    mutationFn: archiveFeatureBanner,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: featureBannersQueryKeys.all }),
  });

  return { isPending, mutate };
}
