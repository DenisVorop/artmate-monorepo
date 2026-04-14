import type { ReactNode } from "react";

import { QueryProvider } from "./query-provider";

type AppProvidersProps = {
  readonly children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return <QueryProvider>{children}</QueryProvider>;
}
