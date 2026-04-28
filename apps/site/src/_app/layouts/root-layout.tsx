import type { ReactNode } from "react";
import { Comfortaa, Nunito } from "next/font/google";

import { getServerDeviceInfo } from "@/shared/lib/device/server";

import { AppProviders } from "../providers/app-providers";

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
  const initialDeviceInfo = await getServerDeviceInfo();

  return (
    <html lang="ru" className={`${comfortaa.variable} ${nunito.variable}`}>
      <body>
        <AppProviders initialDeviceInfo={initialDeviceInfo}>{children}</AppProviders>
      </body>
    </html>
  );
}
