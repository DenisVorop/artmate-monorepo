"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";

import { getQueryClient } from "@/shared/lib/query-client";

type QueryProviderProps = {
  readonly children: ReactNode;
};

export function QueryProvider({ children }: QueryProviderProps) {
  const queryClient = getQueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
