"use client";

import { useQuery } from "@tanstack/react-query";

import { sessionQuery } from "./query";

export function useSessionData() {
  const { data, isError, isPending } = useQuery(sessionQuery.getSession());

  return { data, isError, isPending };
}
