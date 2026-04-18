import type { ReactNode } from "react";
import { Comfortaa, Nunito } from "next/font/google";

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

export function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru" className={`${comfortaa.variable} ${nunito.variable}`}>
      <body>
        <AppProviders>
          <SiteLayout>{children}</SiteLayout>
        </AppProviders>
      </body>
    </html>
  );
}
