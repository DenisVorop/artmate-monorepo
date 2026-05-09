"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { featureBannersQueryKeys } from "@/entities/feature-banners";
import {
  updateFeatureBanner,
  type UpdateFeatureBannerInputDTO,
} from "@/shared/actions/feature-banners";

type UpdateFeatureBannerVariables = {
  readonly bannerId: string;
  readonly input: UpdateFeatureBannerInputDTO;
};

export function useUpdateFeatureBanner() {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить баннер",
      successMessage: "Баннер сохранен",
    },
    mutationFn: ({ bannerId, input }: UpdateFeatureBannerVariables) =>
      updateFeatureBanner(bannerId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: featureBannersQueryKeys.all }),
  });

  return { isPending, mutate };
}
