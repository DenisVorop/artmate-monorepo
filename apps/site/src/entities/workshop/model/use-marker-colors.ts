"use client";

import { useQuery } from "@tanstack/react-query";

import { workshopQuery } from "./query";

export function useMarkerColors(enabled = true) {
  const { data, isError, isPending } = useQuery({
    ...workshopQuery.markerColors(),
    enabled,
  });

  return { colors: data ?? [], isError, isPending };
}
