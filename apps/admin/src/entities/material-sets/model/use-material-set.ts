"use client";

import { useQuery } from "@tanstack/react-query";

import { materialSetsQuery } from "./query";

export function useMaterialSet(id: string) {
  const { data, isPending, isError } = useQuery(materialSetsQuery.detail(id));
  return { materialSet: data, isPending, isError };
}
