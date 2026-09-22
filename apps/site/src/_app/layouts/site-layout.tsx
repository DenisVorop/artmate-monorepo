import type { ReactNode } from "react";

import { CookieConsentBanner } from "@/features/cookie-consent";
import { ServiceBanners } from "@/features/service-banners";
import { WelcomeBonus } from "@/features/welcome-bonus";
import { Footer } from "@/widgets/footer";
import { Header } from "@/widgets/header";

type SiteShellProps = {
  readonly children: ReactNode;
};

export function SiteLayout({ children }: SiteShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <ServiceBanners />
      <Header />
      <div className="min-w-0 flex-1">{children}</div>
      <Footer />
      <WelcomeBonus />
      <CookieConsentBanner />
    </div>
  );
}
