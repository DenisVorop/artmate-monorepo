import { Suspense, type ReactNode } from "react";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { UserProvider, type AuthSession } from "@/entities/session";
import { DeviceProvider, type DeviceInfo } from "@/shared/lib/device";
import { ComposeProviders } from "@/shared/lib/react";
import { QueryStateProvider } from "@/shared/lib/query-state-manager";

import { QueryProvider } from "./query-provider";

type AppProvidersProps = {
  readonly children: ReactNode;
  readonly initialDeviceInfo: DeviceInfo;
  readonly initialSession: AuthSession;
};

export function AppProviders({ children, initialDeviceInfo, initialSession }: AppProvidersProps) {
  return (
    <QueryProvider>
      <ReactQueryDevtools initialIsOpen={false} />

      <ComposeProviders>
        <DeviceProvider initialDeviceInfo={initialDeviceInfo} />
        <UserProvider initialSession={initialSession} />

        <Suspense fallback={null}>
          <QueryStateProvider />
        </Suspense>

        {children}
      </ComposeProviders>
    </QueryProvider>
  );
}
