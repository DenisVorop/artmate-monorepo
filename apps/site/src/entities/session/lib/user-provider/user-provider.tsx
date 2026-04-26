"use client";

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { sessionQuery } from "../../model/query";
import { UserContext } from "./user.context";

type UserProviderProps = {
  readonly children?: ReactNode;
};

export function UserProvider({ children }: UserProviderProps) {
  const { data, isPending } = useQuery(sessionQuery.getSession());
  const value = useMemo(
    () => ({
      user: data?.user ?? null,
      isPending,
    }),
    [data?.user, isPending],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
