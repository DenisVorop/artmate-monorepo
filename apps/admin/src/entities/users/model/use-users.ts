"use client";

import { useQuery } from "@tanstack/react-query";

import { usersQuery } from "./query";

export function useUsers() {
  const { data, isError, isPending, refetch } = useQuery(usersQuery.list());

  return {
    isError,
    isPending,
    refetch,
    users: data ?? [],
  };
}
