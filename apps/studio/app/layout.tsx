import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import "./globals.css";
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
