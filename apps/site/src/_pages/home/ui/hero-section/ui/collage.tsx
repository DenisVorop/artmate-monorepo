import { heroImages } from "../constants";
import { Badge } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { AspectRatio } from "@/shared/ui/aspect-ratio";
import { Card, CardContent, CardDescription, CardTitle } from "@/shared/ui/card";
import { Progress } from "@/shared/ui/progress";
import type { HomeHeroMetrics as HomeHeroMetricsDTO } from "@/entities/home";
import { Star } from "lucide-react";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

type CollageImage = (typeof heroImages)[keyof typeof heroImages];

const frameRingMaskStyle = {
  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
} as CSSProperties;

const frameGradients = {
  workspace: "bg-gradient-to-r from-rose-400 to-amber-400",
  hands: "bg-gradient-to-r from-amber-400 to-orange-400 p-[2px]",
  mandala: "bg-gradient-to-r from-violet-400 to-rose-400 p-[2px]",
} as const;

function CollagePhoto({
  image,
  ratio,
  sizes,
  className,
  frameClassName,
  frameRingClassName,
  children,
}: {
  image: CollageImage;
  ratio: number;
  sizes: string;
  className?: string;
  frameClassName?: string;
  frameRingClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      <AspectRatio ratio={ratio} className={cn("relative overflow-hidden", frameClassName)}>
        <Image
          fill
          preload
          src={image.src}
          alt={image.alt}
          sizes={sizes}
          className="object-cover"
        />
        {children}
        {frameRingClassName && (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 rounded-[inherit] p-[3px]",
              frameRingClassName,
            )}
            style={frameRingMaskStyle}
          />
        )}
      </AspectRatio>
    </div>
  );
}

function RatingMetricCard({ ratingLabel, className }: { ratingLabel: string; className?: string }) {
  return (
    <Card
      className={cn(
        "z-40 gap-0 rounded-2xl border border-stone-100 bg-white py-0 shadow-lg ring-0",
        className,
      )}
    >
      <CardContent className="flex items-center gap-3 px-4 py-3">
        <Badge
          variant="secondary"
          aria-hidden
          className="h-9 w-9 shrink-0 rounded-xl bg-amber-100 p-0 text-amber-400"
        >
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        </Badge>
        <div>
          <CardDescription className="text-xs text-stone-400">Рейтинг</CardDescription>
          <CardTitle className="font-display leading-none font-bold text-stone-900">
            {ratingLabel}
          </CardTitle>
        </div>
      </CardContent>
    </Card>
  );
}

function PaintedMetricCard({
  metrics,
  className,
}: {
  metrics: HomeHeroMetricsDTO;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "z-40 gap-0 rounded-2xl border border-stone-100 bg-white py-0 shadow-lg ring-0",
        className,
      )}
    >
      <CardContent className="px-4 py-3">
        <CardDescription className="mb-0.5 text-xs text-stone-400">
          Уже раскрасили
        </CardDescription>
        <CardTitle className="font-display font-bold text-stone-900">
          {metrics.paintedCountLabel}
        </CardTitle>
        <Progress
          aria-label="Прогресс раскрасок"
          value={metrics.progressValue}
          className="mt-1.5 h-1.5 bg-stone-200 [&_[data-slot=progress-indicator]]:bg-rose-400"
        />
      </CardContent>
    </Card>
  );
}

export function Collage({ metrics }: { metrics: HomeHeroMetricsDTO }) {
  return (
    <div className="order-1 lg:order-2">
      <div className="relative flex min-h-[320px] items-center justify-center sm:min-h-[360px] lg:min-h-0">
        <CollagePhoto
          image={heroImages.workspace}
          ratio={3 / 4}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 27vw, 58vw"
          className="z-20 w-[58%] rotate-[-2deg] sm:w-[52%] lg:w-[55%]"
          frameClassName="rounded-[2rem] shadow-2xl shadow-stone-300/60"
          frameRingClassName={frameGradients.workspace}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/20 to-transparent" />
        </CollagePhoto>

        <CollagePhoto
          image={heroImages.hands}
          ratio={3 / 4}
          sizes="(min-width: 1024px) 23vw, (min-width: 640px) 18vw, 38vw"
          className="absolute top-4 right-0 z-30 w-[38%] rotate-[4deg] sm:w-[34%] lg:top-8 lg:-right-4 lg:w-[38%]"
          frameClassName="rounded-[1.5rem] shadow-xl shadow-stone-300/50"
          frameRingClassName={frameGradients.hands}
        />

        <CollagePhoto
          image={heroImages.mandala}
          ratio={3 / 4}
          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 16vw, 36vw"
          className="absolute bottom-4 left-0 z-10 w-[36%] rotate-[3deg] sm:w-[30%] lg:bottom-6 lg:-left-2"
          frameClassName="rounded-[1.5rem] shadow-xl shadow-stone-300/40"
          frameRingClassName={frameGradients.mandala}
        />

        <RatingMetricCard
          ratingLabel={metrics.ratingLabel}
          className="absolute top-8 left-4 hidden lg:top-20 lg:-left-8 lg:block"
        />

        <PaintedMetricCard
          metrics={metrics}
          className="absolute right-4 bottom-10 hidden lg:-right-6 lg:bottom-16 lg:block"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        <RatingMetricCard
          ratingLabel={metrics.ratingLabel}
          className="shadow-sm shadow-stone-200/50"
        />
        <PaintedMetricCard metrics={metrics} className="shadow-sm shadow-stone-200/50" />
      </div>
    </div>
  );
}
