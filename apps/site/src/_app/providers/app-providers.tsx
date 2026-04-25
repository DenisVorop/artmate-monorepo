import { Suspense, type ReactNode } from "react";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { UserProvider, type AuthUser } from "@/entities/session";
import { ComposeProviders } from "@/shared/lib/react";
import { QueryStateProvider } from "@/shared/lib/query-state-manager";

import { QueryProvider } from "./query-provider";

type AppProvidersProps = {
  readonly children: ReactNode;
  readonly user: AuthUser | null;
};

export function AppProviders({ children, user }: AppProvidersProps) {
  return (
    <QueryProvider>
      <ReactQueryDevtools initialIsOpen={false} />

      <ComposeProviders>
        <UserProvider value={user} />

        <Suspense fallback={null}>
          <QueryStateProvider />
        </Suspense>

        {children}
      </ComposeProviders>
    </QueryProvider>
  );
}
