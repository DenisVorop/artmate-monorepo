import { heroImages } from "../constants";
import { Badge, cn } from "@/shared";
import { AspectRatio } from "@/shared/ui/aspect-ratio";
import { Card, CardContent, CardDescription, CardTitle } from "@/shared/ui/card";
import { Progress } from "@/shared/ui/progress";
import { Star } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

type CollageImage = (typeof heroImages)[keyof typeof heroImages];

function CollagePhoto({
  image,
  ratio,
  sizes,
  className,
  frameClassName,
  children,
}: {
  image: CollageImage;
  ratio: number;
  sizes: string;
  className?: string;
  frameClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      <AspectRatio ratio={ratio} className={cn("overflow-hidden", frameClassName)}>
        <Image
          fill
          preload
          src={image.src}
          alt={image.alt}
          sizes={sizes}
          className="object-cover"
        />
        {children}
      </AspectRatio>
    </div>
  );
}

export function Collage() {
  return (
    <div className="relative order-1 flex min-h-[360px] items-center justify-center lg:order-2 lg:min-h-0">
      <CollagePhoto
        image={heroImages.workspace}
        ratio={3 / 4}
        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 27vw, 58vw"
        className="z-20 w-[58%] rotate-[-2deg] sm:w-[52%] lg:w-[55%]"
        frameClassName="rounded-[2rem] shadow-2xl shadow-stone-300/60"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/20 to-transparent" />
      </CollagePhoto>

      <CollagePhoto
        image={heroImages.hands}
        ratio={4 / 5}
        sizes="(min-width: 1024px) 23vw, (min-width: 640px) 18vw, 38vw"
        className="absolute top-4 right-0 z-30 w-[38%] rotate-[4deg] sm:w-[34%] lg:top-8 lg:-right-4 lg:w-[38%]"
        frameClassName="rounded-[1.5rem] border-4 border-white shadow-xl shadow-stone-300/50"
      />

      <CollagePhoto
        image={heroImages.mandala}
        ratio={1}
        sizes="(min-width: 1024px) 20vw, (min-width: 640px) 16vw, 36vw"
        className="absolute bottom-4 left-0 z-10 w-[36%] rotate-[3deg] sm:w-[30%] lg:bottom-6 lg:-left-2"
        frameClassName="rounded-[1.5rem] border-4 border-white shadow-xl shadow-stone-300/40"
      />

      <Card className="absolute top-8 left-4 z-40 gap-0 rounded-2xl border border-stone-100 bg-white py-0 shadow-lg ring-0 lg:top-20 lg:-left-8">
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
              4.9 / 5
            </CardTitle>
          </div>
        </CardContent>
      </Card>

      <Card className="absolute right-4 bottom-10 z-40 gap-0 rounded-2xl border border-stone-100 bg-white py-0 shadow-lg ring-0 lg:-right-6 lg:bottom-16">
        <CardContent className="px-4 py-3">
          <CardDescription className="mb-0.5 text-xs text-stone-400">
            Уже раскрасили
          </CardDescription>
          <CardTitle className="font-display font-bold text-stone-900">30 000+ человек</CardTitle>
          <Progress
            aria-label="Прогресс раскрасок"
            value={80}
            className="mt-1.5 h-1.5 bg-stone-200 [&_[data-slot=progress-indicator]]:bg-rose-400"
          />
        </CardContent>
      </Card>
    </div>
  );
}
