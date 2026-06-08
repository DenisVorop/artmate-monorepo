"use client";

import { useQuery } from "@tanstack/react-query";

import { catalogLandingsQuery } from "./query";

export function useCatalogLandings() {
  const { data, isError, isPending, refetch } = useQuery(catalogLandingsQuery.list());

  return {
    isError,
    isPending,
    landings: data ?? [],
    refetch,
  };
}
