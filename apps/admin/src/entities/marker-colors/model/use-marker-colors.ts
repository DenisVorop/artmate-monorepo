"use client";

import { useQuery } from "@tanstack/react-query";

import { markerColorsQuery } from "./query";

export function useMarkerColors() {
  const { data, isError, isPending } = useQuery(markerColorsQuery.catalog());

  return {
    isError,
    isPending,
    markerColors: data ?? [],
  };
}
