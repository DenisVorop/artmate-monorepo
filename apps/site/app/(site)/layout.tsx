import type { ReactNode } from "react";

import { SiteLayout } from "@/app/layouts/site-layout";

type SiteRouteLayoutProps = {
  readonly children: ReactNode;
};

export default function SiteRouteLayout({ children }: SiteRouteLayoutProps) {
  return <SiteLayout>{children}</SiteLayout>;
}
