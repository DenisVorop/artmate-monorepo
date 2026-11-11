import type { ReactNode } from "react";

import type { DehydratedState } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { AuthRoot } from "@/features/auth";
import { UserProvider, type AuthSession } from "@/entities/session";
import { DeviceProvider, type DeviceInfo } from "@/shared/lib/device";
import { QueryStateProvider } from "@/shared/lib/query-state-manager";
import { Toaster } from "@/shared/ui/sonner";

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
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        duration={6500}
        customAriaLabel="Уведомления"
      />

      <HydrationBoundary state={dehydratedState}>
        <DeviceProvider initialDeviceInfo={initialDeviceInfo}>
          <UserProvider initialSession={initialSession}>
            <QueryStateProvider>
              <AuthRoot>{children}</AuthRoot>
            </QueryStateProvider>
          </UserProvider>
        </DeviceProvider>
      </HydrationBoundary>
    </QueryProvider>
  );
}
