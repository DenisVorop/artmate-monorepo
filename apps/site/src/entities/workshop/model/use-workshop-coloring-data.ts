"use client";

import { useQuery } from "@tanstack/react-query";

import { workshopQuery } from "./query";

export function useWorkshopColoringData(slug: string, number: number) {
  const { data, isError, isPending, refetch } = useQuery(workshopQuery.coloring(slug, number));

  return { data, isError, isPending, refetch };
}
