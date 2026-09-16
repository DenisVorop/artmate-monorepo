import type { Metadata } from "next";
import { Comfortaa, Nunito } from "next/font/google";
import type { ReactNode } from "react";

import { QueryProvider } from "@/app/providers";

const nunito = Nunito({
  display: "swap",
  subsets: ["cyrillic", "latin"],
  variable: "--font-nunito",
});

const comfortaa = Comfortaa({
  display: "swap",
  subsets: ["cyrillic", "latin"],
  variable: "--font-comfortaa",
});

export const metadata: Metadata = {
  title: { default: "Кабинет партнёра | Artmate", template: "%s | Artmate" },
  description: "Кабинет партнёрской программы Artmate",
  robots: { follow: false, index: false },
};

export function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html className={`${nunito.variable} ${comfortaa.variable}`} lang="ru">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
