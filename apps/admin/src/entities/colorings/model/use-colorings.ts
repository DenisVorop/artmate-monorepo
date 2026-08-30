"use client";

import { useQuery } from "@tanstack/react-query";

import { coloringsQuery } from "./query";

export function useColorings() {
  const { data, isError, isPending, refetch } = useQuery(coloringsQuery.list());

  return {
    colorings: data ?? [],
    isError,
    isPending,
    refetch,
  };
}
