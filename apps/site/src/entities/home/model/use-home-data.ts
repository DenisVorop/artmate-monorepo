"use client";

import { useQuery } from "@tanstack/react-query";

import { homeQuery } from "./query";

export function useHomeData() {
  const { data, isError } = useQuery(homeQuery.getData());

  return { data, isError };
}
