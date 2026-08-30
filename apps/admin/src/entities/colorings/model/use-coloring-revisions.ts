"use client";

import { useQuery } from "@tanstack/react-query";

import { coloringsQuery } from "./query";

type UseColoringRevisionsParams = {
  readonly coloringId: string;
};

export function useColoringRevisions({
  coloringId,
}: UseColoringRevisionsParams) {
  const { data, isError, isPending, refetch } = useQuery(
    coloringsQuery.revisions(coloringId),
  );

  return {
    isError,
    isPending,
    refetch,
    revisions: data ?? [],
  };
}
