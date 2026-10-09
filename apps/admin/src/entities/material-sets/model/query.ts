import { queryOptions } from "@tanstack/react-query";

import {
  getMaterialSet,
  getMaterialSets,
} from "@/shared/actions/material-sets";

export const materialSetsQueryKeys = {
  all: ["admin-material-sets"] as const,
  detail: (id: string) => ["admin-material-sets", "detail", id] as const,
};

export const materialSetsQuery = {
  detail: (id: string) =>
    queryOptions({
      queryKey: materialSetsQueryKeys.detail(id),
      queryFn: () => getMaterialSet(id),
      enabled: Boolean(id),
      staleTime: Infinity,
      retryOnMount: false,
    }),
  list: () =>
    queryOptions({
      queryKey: materialSetsQueryKeys.all,
      queryFn: getMaterialSets,
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
