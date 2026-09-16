"use client";

import { useQuery } from "@tanstack/react-query";

import { partnerApplicationsQuery } from "./query";

export function usePartnerApplicationSelection() {
  const { data, isError, isPending, refetch } = useQuery(
    partnerApplicationsQuery.selection(),
  );

  return {
    applications: data ?? [],
    isError,
    isPending,
    refetch,
  };
}
