import type { ReactNode } from "react";
import { Comfortaa, Nunito } from "next/font/google";
import { HydrationBoundary } from "@tanstack/react-query";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

import { LayoutDataBuilder } from "../lib/layout-data-builder";
import { AppProviders } from "../providers/app-providers";
import { SiteLayout } from "./site-layout";

const comfortaa = Comfortaa({
  subsets: ["latin", "cyrillic"],
  weight: "variable",
  display: "swap",
  variable: "--font-comfortaa",
});

const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  weight: "variable",
  display: "swap",
  variable: "--font-nunito",
});

type RootLayoutProps = {
  readonly children: ReactNode;
};

export async function RootLayout({ children }: RootLayoutProps) {
  const { queryClient } = await new LayoutDataBuilder().build();

  return (
    <html lang="ru" className={`${comfortaa.variable} ${nunito.variable}`}>
      <body>
        <AppProviders>
          <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
            <SiteLayout>{children}</SiteLayout>
          </HydrationBoundary>
        </AppProviders>
      </body>
    </html>
  );
}
