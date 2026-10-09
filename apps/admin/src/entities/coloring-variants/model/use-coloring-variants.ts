"use client";

import { useQuery } from "@tanstack/react-query";

import { coloringVariantsQuery } from "./query";

export function useColoringVariants(coloringId: string) {
  const { data, isPending, isError } = useQuery(
    coloringVariantsQuery.detail(coloringId),
  );
  return { variants: data, isPending, isError };
}
