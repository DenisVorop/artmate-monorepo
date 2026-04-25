"use client";

import type { ReactNode } from "react";

import type { AuthUser } from "../../model/types";
import { UserContext } from "./user.context";

type UserProviderProps = {
  readonly children?: ReactNode;
  readonly value: AuthUser | null;
};

export function UserProvider({ children, value }: UserProviderProps) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
