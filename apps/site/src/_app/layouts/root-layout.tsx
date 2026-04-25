import type { ReactNode } from "react";
import { Comfortaa, Nunito } from "next/font/google";

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
  const { session } = await new LayoutDataBuilder().withSession().build();

  return (
    <html lang="ru" className={`${comfortaa.variable} ${nunito.variable}`}>
      <body>
        <AppProviders user={session?.user ?? null}>
          <SiteLayout>{children}</SiteLayout>
        </AppProviders>
      </body>
    </html>
  );
}
