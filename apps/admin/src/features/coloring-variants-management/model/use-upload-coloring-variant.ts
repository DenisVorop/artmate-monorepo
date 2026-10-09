"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { coloringVariantsQueryKeys } from "@/entities/coloring-variants";
import { uploadColoringVariant } from "@/shared/actions/coloring-variants";
import { showToast } from "@/shared/lib/toast-store";

export function useUploadColoringVariant(coloringId: string) {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    meta: { disableToast: true },
    mutationFn: (data: FormData) => uploadColoringVariant(coloringId, data),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(
        coloringVariantsQueryKeys.detail(coloringId),
        result.data,
      );
      showToast({ title: "Изображения и палитра сохранены" });
    },
  });
  return { mutate, isPending };
}
