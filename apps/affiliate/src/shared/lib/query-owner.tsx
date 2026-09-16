"use client";

import { createContext, type ReactNode, useContext } from "react";

const QueryOwnerContext = createContext<string | null>(null);

export function QueryOwnerProvider({
  children,
  ownerId,
}: {
  readonly children: ReactNode;
  readonly ownerId: string;
}) {
  return <QueryOwnerContext value={ownerId}>{children}</QueryOwnerContext>;
}

export function useQueryOwnerId() {
  const ownerId = useContext(QueryOwnerContext);

  if (!ownerId) {
    throw new Error("Partner query must be used within QueryOwnerProvider");
  }

  return ownerId;
}
