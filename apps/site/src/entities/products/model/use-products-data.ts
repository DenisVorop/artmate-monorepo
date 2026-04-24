"use client";

import { useQuery } from "@tanstack/react-query";

import { productsQuery } from "./query";

export function useProductsData() {
  const { data, isError } = useQuery(productsQuery.getData());

  return { data, isError };
}
