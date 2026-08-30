"use client";

import { useQuery } from "@tanstack/react-query";

import { coloringsQuery } from "./query";

type UseColoringParams = {
  readonly coloringId: string;
};

export function useColoring({ coloringId }: UseColoringParams) {
  const { data, isError, isPending, refetch } = useQuery(
    coloringsQuery.detail(coloringId),
  );

  return {
    coloring: data,
    isError,
    isPending,
    refetch,
  };
}
