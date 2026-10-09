import { materialSetsQuery } from "@/entities/material-sets";
import { getQueryClient } from "@/shared/lib/query-client";

export async function buildMaterialSetsData() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(materialSetsQuery.list());
  return queryClient;
}
