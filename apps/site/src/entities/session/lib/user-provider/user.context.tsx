"use client";

import { createContext } from "react";

import type { AuthUser } from "../../model/types";

export type UserContextValue = {
  user: AuthUser | null;
  isPending: boolean;
};

export const UserContext = createContext<UserContextValue | undefined>(undefined);
