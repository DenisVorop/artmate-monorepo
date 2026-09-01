"use client";

import { useQuery } from "@tanstack/react-query";

import { workshopQuery } from "./query";

export function useWorkshopData() {
  const { data, isError, isPending, refetch } = useQuery(workshopQuery.owner());

  return { workshop: data, isError, isPending, refetch };
}
