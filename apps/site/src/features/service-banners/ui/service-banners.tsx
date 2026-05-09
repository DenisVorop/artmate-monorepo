"use client";

import { Megaphone } from "lucide-react";

import {
  getFeatureBannerCta,
  type FeatureBanner,
  useFeatureBanners,
} from "@/entities/feature-banners";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

export function ServiceBanners() {
  const { banners, isError, isPending } = useFeatureBanners();

  if (isPending || isError || banners.length === 0) {
    return null;
  }

  return (
    <section aria-label="Сервисные уведомления" className="border-b bg-background">
      <div className="container grid gap-2 py-2">
        {banners.map((banner) => (
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
        "flex flex-col gap-3 rounded-lg border px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between",
        getToneClassName(banner.tone),
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-background/70">
          <Megaphone className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">{banner.title}</p>
          <p className="text-muted-foreground">{banner.description}</p>
        </div>
      </div>

      {cta ? (
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      ) : null}
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
