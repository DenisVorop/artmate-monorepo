import type { ReactNode } from "react";

import { CookieConsentBanner } from "@/features/cookie-consent";
import { ServiceBanners } from "@/features/service-banners";
import { Footer } from "@/widgets/footer";
import { Header } from "@/widgets/header";

type SiteShellProps = {
  readonly children: ReactNode;
};

export function SiteLayout({ children }: SiteShellProps) {
  return (
    <div className="min-h-dvh">
      <ServiceBanners />
      <Header />
      {children}
      <Footer />
      <CookieConsentBanner />
    </div>
  );
}
