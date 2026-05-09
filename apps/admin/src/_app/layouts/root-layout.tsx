import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "@/app/providers";

export const metadata: Metadata = {
  title: "Artmate Admin",
  description: "Административная панель Artmate",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  robots: {
    index: false,
    follow: false,
  },
};

type RootLayoutProps = {
  readonly children: ReactNode;
};

export function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
