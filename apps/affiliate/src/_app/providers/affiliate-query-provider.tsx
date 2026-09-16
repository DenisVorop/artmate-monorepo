"use client";

import {
  HydrationBoundary,
  QueryClientProvider,
  type DehydratedState,
} from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { makeQueryClient } from "@/shared/lib/query-client";
import { QueryOwnerProvider } from "@/shared/lib/query-owner";

type AffiliateQueryProviderProps = {
  readonly children: ReactNode;
  readonly ownerId: string;
  readonly state: DehydratedState;
};

export function AffiliateQueryProvider({
  children,
  ownerId,
  state,
}: AffiliateQueryProviderProps) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <QueryOwnerProvider ownerId={ownerId}>
        <HydrationBoundary state={state}>{children}</HydrationBoundary>
      </QueryOwnerProvider>
    </QueryClientProvider>
  );
}
