import type { ReactNode } from "react";
import { Comfortaa } from "next/font/google";

import { AppProviders } from "../providers/app-providers";
import { SiteLayout } from "./site-layout";

const comfortaa = Comfortaa({
  subsets: ["latin", "cyrillic"],
  weight: "variable",
  display: "swap",
});

type RootLayoutProps = {
  readonly children: ReactNode;
};

export function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru">
      <body className={`${comfortaa.className}`}>
        <AppProviders>
          <SiteLayout>{children}</SiteLayout>
        </AppProviders>
      </body>
    </html>
  );
}
