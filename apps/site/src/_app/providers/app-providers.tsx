import { Suspense, type ReactNode } from "react";

import type { DehydratedState } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { UserProvider, type AuthSession } from "@/entities/session";
import { DeviceProvider, type DeviceInfo } from "@/shared/lib/device";
import { QueryStateProvider } from "@/shared/lib/query-state-manager";

import { QueryProvider } from "./query-provider";

type AppProvidersProps = {
  readonly children: ReactNode;
  readonly dehydratedState?: DehydratedState;
  readonly initialDeviceInfo: DeviceInfo;
  readonly initialSession: AuthSession;
};

export function AppProviders({
  children,
  dehydratedState,
  initialDeviceInfo,
  initialSession,
}: AppProvidersProps) {
  return (
    <QueryProvider>
      <ReactQueryDevtools initialIsOpen={false} />

      <HydrationBoundary state={dehydratedState}>
        <DeviceProvider initialDeviceInfo={initialDeviceInfo}>
          <UserProvider initialSession={initialSession}>
            <Suspense fallback={null}>
              <QueryStateProvider />
            </Suspense>

            {children}
          </UserProvider>
        </DeviceProvider>
      </HydrationBoundary>
    </QueryProvider>
  );
}
