"use client";

import { useQuery } from "@tanstack/react-query";

import { workshopQuery } from "./query";

export function useWorkshopCollectionData(slug: string) {
  const { data, isError, isPending, refetch } = useQuery(workshopQuery.collection(slug));

  return { collection: data, isError, isPending, refetch };
}
