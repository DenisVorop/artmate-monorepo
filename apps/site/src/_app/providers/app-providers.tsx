import { Suspense, type ReactNode } from "react";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { UserProvider } from "@/entities/session";
import { ComposeProviders } from "@/shared/lib/react";
import { QueryStateProvider } from "@/shared/lib/query-state-manager";

import { QueryProvider } from "./query-provider";

type AppProvidersProps = {
  readonly children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <ReactQueryDevtools initialIsOpen={false} />

      <ComposeProviders>
        <UserProvider />

        <Suspense fallback={null}>
          <QueryStateProvider />
        </Suspense>

        {children}
      </ComposeProviders>
    </QueryProvider>
  );
}
