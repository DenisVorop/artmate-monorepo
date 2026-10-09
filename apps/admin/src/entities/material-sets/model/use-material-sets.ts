"use client";

import { useQuery } from "@tanstack/react-query";

import { materialSetsQuery } from "./query";

export function useMaterialSets() {
  const { data, isPending, isError } = useQuery(materialSetsQuery.list());
  return { materialSets: data ?? [], isPending, isError };
}
