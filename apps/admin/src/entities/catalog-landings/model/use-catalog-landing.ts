"use client";

import { useQuery } from "@tanstack/react-query";

import { catalogLandingsQuery } from "./query";

type UseCatalogLandingParams = {
  readonly landingId: string;
};

export function useCatalogLanding({ landingId }: UseCatalogLandingParams) {
  const { data, isError, isPending, refetch } = useQuery(
    catalogLandingsQuery.detail(landingId),
  );

  return {
    isError,
    isPending,
    landing: data,
    refetch,
  };
}
