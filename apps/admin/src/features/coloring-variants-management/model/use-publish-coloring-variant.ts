"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { coloringCollectionsQueryKeys } from "@/entities/coloring-collections";
import { coloringVariantsQueryKeys } from "@/entities/coloring-variants";
import { coloringsQueryKeys } from "@/entities/colorings";
import { publishColoringVariant } from "@/shared/actions/coloring-variants";
import { showToast } from "@/shared/lib/toast-store";

export function usePublishColoringVariant(coloringId: string, target: string) {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    meta: { disableToast: true },
    mutationFn: (input: { expectedToken: string }) =>
      publishColoringVariant(coloringId, target, input),
    onSuccess: async (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(
        coloringVariantsQueryKeys.detail(coloringId),
        result.data,
      );
      showToast({
        title:
          target === "original"
            ? "Оригинал опубликован"
            : "Адаптация опубликована",
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: coloringsQueryKeys.detail(coloringId),
        }),
        queryClient.invalidateQueries({ queryKey: coloringsQueryKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: coloringCollectionsQueryKeys.all,
        }),
      ]);
    },
  });
  return { mutate, isPending };
}
