import { Suspense, type ReactNode } from "react";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { UserProvider } from "@/entities/session";
import { DeviceProvider, type DeviceInfo } from "@/shared/lib/device";
import { ComposeProviders } from "@/shared/lib/react";
import { QueryStateProvider } from "@/shared/lib/query-state-manager";

import { QueryProvider } from "./query-provider";

type AppProvidersProps = {
  readonly children: ReactNode;
  readonly initialDeviceInfo: DeviceInfo;
};

export function AppProviders({ children, initialDeviceInfo }: AppProvidersProps) {
  return (
    <QueryProvider>
      <ReactQueryDevtools initialIsOpen={false} />

      <ComposeProviders>
        <DeviceProvider initialDeviceInfo={initialDeviceInfo} />
        <UserProvider />

        <Suspense fallback={null}>
          <QueryStateProvider />
        </Suspense>

        {children}
      </ComposeProviders>
    </QueryProvider>
  );
}
