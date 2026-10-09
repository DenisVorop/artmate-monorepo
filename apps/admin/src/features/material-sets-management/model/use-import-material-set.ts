"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  materialSetsQueryKeys,
  type MaterialSetSummary,
} from "@/entities/material-sets";
import { importMaterialSet } from "@/shared/actions/material-sets";

export function useImportMaterialSet() {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: importMaterialSet,
    meta: { disableToast: true },
    onSuccess: async (result) => {
      if (!result.ok) return;
      queryClient.setQueryData<MaterialSetSummary[]>(
        materialSetsQueryKeys.all,
        (current = []) => [
          result.data,
          ...current.filter((item) => item.id !== result.data.id),
        ],
      );
      await queryClient.invalidateQueries({
        queryKey: materialSetsQueryKeys.all,
      });
    },
  });
  return { mutate, isPending };
}
