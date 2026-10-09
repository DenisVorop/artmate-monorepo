"use client";

import { CommunityWorkCard, type useCollectionCommunityWorks } from "@/entities/community-work";
import { Button } from "@/shared/ui";
import { Skeleton } from "@/shared/ui/skeleton";
import { SectionTitle } from "@/shared/ui/typography";

import { useWorksScroll } from "../lib/use-works-scroll";

type CommunityWorksProps = ReturnType<typeof useCollectionCommunityWorks>;

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
        <ul className="flex flex-1 gap-4">
          {works.map((work) => (
            <li
              key={work.publicId}
              className="w-[70vw] max-w-80 shrink-0 snap-start sm:w-64 lg:w-72"
            >
              <CommunityWorkCard work={work} />
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
      </div>
    </section>
  );
}
