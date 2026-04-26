"use client";

import { useContext } from "react";

import { UserContext } from "./user.context";

export function useSession() {
  const session = useContext(UserContext);

  if (session === undefined) {
    throw new Error("useUser must be used within UserProvider");
  }

  return session;
}

export function useUser() {
  return useSession().user;
}
