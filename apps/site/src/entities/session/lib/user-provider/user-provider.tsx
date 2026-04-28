"use client";

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { sessionQuery } from "../../model/query";
import type { AuthSession } from "../../model/types";
import { UserContext } from "./user.context";

type UserProviderProps = {
  readonly children?: ReactNode;
  readonly initialSession: AuthSession;
};

export function UserProvider({ children, initialSession }: UserProviderProps) {
  const { data, isPending } = useQuery({
    ...sessionQuery.getSession(),
    initialData: initialSession,
  });
  const value = useMemo(
    () => ({
      user: data?.user ?? null,
      isPending,
    }),
    [data?.user, isPending],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
