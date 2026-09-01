"use client";

import { useQuery } from "@tanstack/react-query";

import { workshopQuery } from "./query";

export function useWorkshopTools() {
  const { data, isError, isPending } = useQuery(workshopQuery.tools());

  return { tools: data ?? [], isError, isPending };
}
