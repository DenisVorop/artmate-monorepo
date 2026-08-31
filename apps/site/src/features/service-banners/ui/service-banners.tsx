"use client";

import { Megaphone } from "lucide-react";

import {
  featureBannerSlugs,
  getFeatureBannerCta,
  type FeatureBanner,
  useFeatureBanners,
} from "@/entities/feature-banners";
import { useSession } from "@/entities/session";
import { getQueryOwner } from "@/shared/lib/query-keys";
import { cn } from "@/shared/lib/utils";
import { Link } from "@/shared/ui/link";

export function ServiceBanners() {
  const { isPending: isSessionPending, user } = useSession();
  const { banners, isError, isPending } = useFeatureBanners({
    enabled: !isSessionPending,
    owner: getQueryOwner(user?.id),
  });
  const visibleBanners = banners.filter(
    (banner) =>
      banner.slug !== featureBannerSlugs.siteDevelopment &&
      banner.slug !== featureBannerSlugs.welcomeBonus,
  );

  if (isPending || isError || visibleBanners.length === 0) {
    return null;
  }

  return (
    <section aria-label="Сервисные уведомления" className="bg-background">
      <div className="grid">
        {visibleBanners.map((banner) => (
          <ServiceBannerItem banner={banner} key={banner.id} />
        ))}
      </div>
    </section>
  );
}

function ServiceBannerItem({ banner }: { readonly banner: FeatureBanner }) {
  const cta = getFeatureBannerCta(banner);

  return (
    <div
      className={cn(
        "border-b px-3 py-1.5 text-xs sm:text-sm",
        getToneClassName(banner.tone),
      )}
    >
      <div className="container flex min-h-7 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
        <Megaphone className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="font-medium">{banner.title}</span>
        <span className="text-current/80">{banner.description}</span>
        {cta ? (
          <Link
            href={cta.href}
            className="font-semibold underline underline-offset-4 hover:text-current/80 focus-visible:text-current/80"
          >
            {cta.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function getToneClassName(tone: FeatureBanner["tone"]) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "info":
      return "border-primary/20 bg-primary/5 text-foreground";
  }
}
