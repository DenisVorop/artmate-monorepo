"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { partnerApplicationsQuery } from "./query";
import type { PartnerApplicationsListParams } from "./types";

export function usePartnerApplications(params: PartnerApplicationsListParams) {
  const { data, isError, isFetching, isPending, refetch } = useQuery({
    ...partnerApplicationsQuery.list(params),
    placeholderData: keepPreviousData,
  });

  return {
    applications: data?.items ?? [],
    isError,
    isFetching,
    isPending,
    page: data,
    refetch,
  };
}
