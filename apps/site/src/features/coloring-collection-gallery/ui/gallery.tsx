"use client";

import { useRef, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

import { useColoringCollectionData, type ColoringCollection } from "@/entities/coloring-collection";
import { routes } from "@/shared/constants";
import { useVisibleImage } from "@/shared/lib/hooks/use-visible-image";
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  CtaGradientLink,
  DataState,
  PageHero,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { getDigitalCollectionPresentation } from "../lib/presentation";
import { useTrackOpen } from "../lib/use-track-open";
import { useAnalytics } from "../lib/analytics";

type ColoringCollectionGalleryProps = {
  slug: string;
  workshopAction?: ReactNode;
};

export function ColoringCollectionGallery({
  slug,
  workshopAction,
}: ColoringCollectionGalleryProps) {
  const { collection, isError, isPending, refetch } = useColoringCollectionData(slug);
  const analytics = useAnalytics();
  useTrackOpen(!isPending && !isError ? collection?.slug : undefined);

  if (isPending) {
    return (
      <main className="container py-10">
        <DataState
          title="Загружаем тематику"
          description="Подготавливаем галерею цифровых раскрасок."
        />
      </main>
    );
  }

  if (isError || !collection) {
    return (
      <main className="container py-10">
        <DataState
          variant="error"
          title="Не удалось загрузить тематику"
          description="Проверьте соединение и попробуйте ещё раз."
        />
        <div className="mt-4 flex justify-center">
          <Button type="button" className="min-h-11" onClick={() => {
            analytics.retried(slug);
            void refetch();
          }}>
            Повторить
          </Button>
        </div>
      </main>
    );
  }

  const presentation = getDigitalCollectionPresentation(collection);

  return (
    <main className="bg-stone-100/80 text-stone-900">
      <section className="container py-5 md:py-8">
        <PageHero
          breadcrumbs={[
            { label: "Главная", href: routes.home },
            { label: "Цифровые версии", href: routes.colorings },
            { label: presentation.albumTitle },
          ]}
          title={presentation.heading}
          description={presentation.instruction}
          actions={
            <Button
              asChild
              size="lg"
              className="min-h-11 border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 px-5 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95"
            >
              <CtaGradientLink
                href={routes.product(collection.product.category?.slug, collection.product.slug)}
                aria-label={`Посмотреть альбом «${presentation.albumTitle}»`}
                onClick={() => analytics.printAlbumClicked(collection.slug, collection.product.id)}
                data-site-product-link=""
              >
                Посмотреть альбом
                <ArrowUpRight />
              </CtaGradientLink>
            </Button>
          }
        />
      </section>

      <section
        className="container space-y-4 pb-12 md:space-y-5 md:pb-16"
        aria-label={`Иллюстрации «${collection.title}»`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-stone-600">{collection.coloringCount} картин</p>
          {workshopAction}
        </div>
        {collection.colorings.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-5">
            {collection.colorings.map((coloring, index) => (
              <ColoringThumbnail key={coloring.id} coloring={coloring} slug={collection.slug} eager={index === 0} />
            ))}
          </ul>
        ) : (
          <DataState
            title="Иллюстрации скоро появятся"
            description="Мы наполняем эту тематику цифровыми раскрасками."
          />
        )}
      </section>
    </main>
  );
}


function ColoringThumbnail({ coloring, slug, eager }: {
  coloring: ColoringCollection["colorings"][number];
  slug: string;
  eager: boolean;
}) {
  const analytics = useAnalytics();
  const image = useRef<HTMLImageElement>(null);
  const displayNumber = coloring.number;
  useVisibleImage(image, displayNumber, () => analytics.thumbnailViewed(slug, displayNumber));

  return (
  <li className="h-full min-w-0">
    <Link
      href={routes.coloring(slug, displayNumber)}
      onClick={() => analytics.pictureClicked(slug, displayNumber)}
      aria-label={`Открыть картину ${displayNumber}: ${coloring.title}`}
      className="group block h-full rounded-xl focus-visible:ring-3 focus-visible:ring-rose-400 focus-visible:outline-none"
    >
      <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow duration-300 group-hover:shadow-md">
        <div
          className="relative overflow-hidden bg-muted"
          style={{ aspectRatio: `${coloring.card.width} / ${coloring.card.height}` }}
        >
          <Image
            ref={image}
            fill
            src={coloring.card.url}
            alt={coloring.card.alt}
            unoptimized
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : undefined}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
          <span className="absolute top-2 left-2 flex size-7 items-center justify-center rounded-full bg-white/95 text-xs font-bold text-rose-700 shadow-sm">
            {displayNumber}
          </span>
        </div>
        <CardContent className="px-3 py-3 sm:px-4">
          <CardTitle
            role="heading"
            aria-level={2}
            className="line-clamp-2 min-h-[2.75em] text-sm leading-snug text-stone-900 sm:text-base"
          >
            {coloring.title}
          </CardTitle>
        </CardContent>
      </Card>
    </Link>
  </li>
  );
}
