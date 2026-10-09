"use client";

import { useMutation } from "@tanstack/react-query";

import { previewMaterialSetImport } from "@/shared/actions/material-sets";

export function usePreviewMaterialSet() {
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: previewMaterialSetImport,
    meta: { disableToast: true },
  });
  return { mutate, isPending };
}
