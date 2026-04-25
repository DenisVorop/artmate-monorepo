"use client";

import { useContext } from "react";

import { UserContext } from "./user.context";

export function useUser() {
  const user = useContext(UserContext);

  if (user === undefined) {
    throw new Error("useUser must be used within UserProvider");
  }

  return user;
}
