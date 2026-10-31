"use client";

import { ArrowUpRight, Images } from "lucide-react";
import {
  CommunityWorkCard,
  getGalleryCollectionSlug,
  type useCollectionCommunityWorks,
} from "@/entities/community-work";
import { routes } from "@/shared/constants";
import { Link } from "@/shared/ui/link";
import { Button, Card, CardContent } from "@/shared/ui";
import { Skeleton } from "@/shared/ui/skeleton";
import { SectionTitle } from "@/shared/ui/typography";

import { useWorksScroll } from "../lib/use-works-scroll";

type CommunityWorksProps = ReturnType<typeof useCollectionCommunityWorks> & {
  collectionSlug: string;
};

export function CommunityWorks(props: CommunityWorksProps) {
  const { works, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = props;
  const { trackRef, endRef } = useWorksScroll({ ...props, count: works.length });
  if (!works.length) return null;

  return (
    <section
      id="product-community-works"
      aria-labelledby="product-community-works-heading"
      className="min-w-0 scroll-mt-24 space-y-5 py-6 md:py-8"
    >
      <div className="space-y-2">
        <SectionTitle id="product-community-works-heading">Работы пользователей</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Посмотрите, как другие раскрасили картины из этого альбома.
        </p>
      </div>
      <div
        ref={trackRef}
        role="region"
        aria-label="Лента работ пользователей"
        className="relative flex snap-x snap-proximity items-stretch gap-4 overflow-x-auto overscroll-x-contain rounded-xl pb-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ul className="flex shrink-0 gap-4">
          {works.map((work) => (
            <li
              key={work.publicId}
              className="w-[70vw] max-w-80 shrink-0 snap-start sm:w-64 lg:w-72"
            >
              <CommunityWorkCard
                work={work}
                href={routes.galleryCollection(getGalleryCollectionSlug(props.collectionSlug))}
              />
            </li>
          ))}
        </ul>
        {hasNextPage && (
          <div ref={endRef} className="flex shrink-0 items-center" aria-live="polite">
            {isFetchNextPageError ? (
              <div className="w-48 space-y-3 p-4 text-sm">
                <p>Не удалось загрузить следующие работы.</p>
                <Button variant="outline" onClick={() => void fetchNextPage()}>
                  Повторить
                </Button>
              </div>
            ) : (
              <div role="status" aria-label="Загружаем работы" className="w-64">
                <Skeleton className="aspect-[4/5] rounded-xl" />
                <span className="sr-only">
                  {isFetchingNextPage ? "Загружаем работы" : "Следующие работы"}
                </span>
              </div>
            )}
          </div>
        )}
        <Link
          href={routes.galleryCollection(getGalleryCollectionSlug(props.collectionSlug))}
          className="group w-[70vw] max-w-80 shrink-0 snap-start rounded-2xl focus-visible:ring-3 focus-visible:ring-rose-400 sm:w-64 lg:w-72"
        >
          <Card className="h-full justify-center border-rose-100 bg-rose-50/60 transition-colors group-hover:bg-rose-50">
            <CardContent className="flex flex-col items-start gap-5 p-6">
              <Images className="size-8 text-rose-500" aria-hidden="true" />
              <span className="font-heading text-xl leading-snug font-semibold">
                Все работы альбома
              </span>
              <span className="flex items-center gap-2 text-sm font-medium">
                Открыть галерею <ArrowUpRight className="size-4" aria-hidden="true" />
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </section>
  );
}
