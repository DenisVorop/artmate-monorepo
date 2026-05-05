import type { ReactNode } from "react";
import { Comfortaa, Nunito } from "next/font/google";

import type { AuthSession } from "@/entities/session";
import { getAuthSession } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import { getServerDeviceInfo } from "@/shared/lib/device/server";
import { RootStructuredData } from "@/shared/lib/seo";

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
  const [initialDeviceInfo, initialSession] = await Promise.all([
    getServerDeviceInfo(),
    getInitialAuthSession(),
  ]);

  return (
    <html lang="ru" className={`${comfortaa.variable} ${nunito.variable}`}>
      <body>
        <RootStructuredData />
        <AppProviders initialDeviceInfo={initialDeviceInfo} initialSession={initialSession}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}

async function getInitialAuthSession(): Promise<AuthSession> {
  const result = ApiResult.fromDTO(await getAuthSession());

  if (result.isError) {
    return { user: null };
  }

  return result.data ?? { user: null };
}
