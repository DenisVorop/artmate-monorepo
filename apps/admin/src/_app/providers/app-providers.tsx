import { type ReactNode } from "react";

import { Toaster } from "@/shared/ui";

import { QueryProvider } from "./query-provider";

type AppProvidersProps = {
  readonly children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      {children}
      <Toaster />
    </QueryProvider>
  );
}
