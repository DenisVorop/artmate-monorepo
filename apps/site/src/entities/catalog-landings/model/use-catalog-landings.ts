"use client";

import { useQuery } from "@tanstack/react-query";

import { catalogLandingsQuery } from "./query";

export function useCatalogLandings() {
  const { data, isError, isPending } = useQuery(catalogLandingsQuery.getList());

  return {
    isError,
    isPending,
    landings: data ?? [],
  };
}
