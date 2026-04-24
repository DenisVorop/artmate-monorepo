import type { HomeHeroMetrics as HomeHeroMetricsDTO } from "@/entities/home";
import type { ReviewStats } from "@/entities/reviews";
import { Heading } from "./ui/heading";
import { Subheading } from "./ui/subheading";
import { Collage } from "./ui/collage";
import { Reviews } from "./ui/reviews";
import { CTA } from "./ui/cta";
import { DecorDots } from "@/shared/ui";
import { cn } from "@/shared/lib";

export function HeroSection({
  metrics,
  reviewStats,
  className,
}: {
  metrics: HomeHeroMetricsDTO;
  reviewStats?: ReviewStats;
  className?: string;
}) {
  return (
    <section className={cn("relative z-10 container flex flex-1 items-center", className)}>
      <div className="grid w-full items-center gap-8 lg:grid-cols-[1fr_1.1fr] xl:gap-16">
        <div className="relative isolate order-2 lg:order-1">
          <DecorDots className="-top-24 -left-24 z-0 h-72 w-96 lg:-top-28 lg:-left-28" />
          <DecorDots
            tone="indigo"
            className="-bottom-14 left-44 z-0 hidden h-48 w-64 sm:block lg:-bottom-12 lg:left-72"
          />

          <div className="relative z-10">
            <Heading />

            <Subheading />

            <CTA />

            <Reviews stats={reviewStats} />
          </div>
        </div>

        <div className="relative isolate order-1 lg:order-2">
          <DecorDots
            tone="amber"
            className="-top-12 right-0 z-0 h-80 w-[28rem] lg:-top-10 lg:-right-6"
          />
          <DecorDots
            tone="indigo"
            className="-bottom-6 left-0 z-0 h-56 w-72 sm:-bottom-4 lg:-left-8"
          />

          <div className="relative z-10">
            <Collage metrics={metrics} />
          </div>
        </div>
      </div>
    </section>
  );
}
