"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { getBrowserQueryClient } from "@/shared/lib";

type QueryProviderProps = {
  readonly children: ReactNode;
};

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(() => getBrowserQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
