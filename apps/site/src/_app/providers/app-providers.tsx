import { Suspense, type ReactNode } from "react";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { QueryStateProvider } from "@/shared/lib/query-state-manager";

import { QueryProvider } from "./query-provider";

type AppProvidersProps = {
  readonly children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <ReactQueryDevtools initialIsOpen={false} />

      <Suspense fallback={children}>
        <QueryStateProvider>{children}</QueryStateProvider>
      </Suspense>
    </QueryProvider>
  );
}
