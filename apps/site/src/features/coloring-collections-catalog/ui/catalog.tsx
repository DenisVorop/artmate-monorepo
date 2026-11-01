"use client";

import Image from "next/image";

import {
  type ColoringCollectionSummary,
  useColoringCollectionsData,
} from "@/entities/coloring-collection";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib/utils";
import { AspectRatio, Button, DataState } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { useTrackOpen } from "../lib/use-track-open";

// Account for the capped container, grid gaps and the space around each cover.
const coverSizes =
  "(min-width: 96rem) 16.675rem, (min-width: 80rem) 13.475rem, (min-width: 64rem) 10.275rem, (min-width: 48rem) 13.375rem, (min-width: 40rem) 17.25rem, calc(50vw - 2.375rem)";
const bindingClassName =
  "pointer-events-none absolute inset-y-0 -left-[3%] h-full w-[6.8%] overflow-visible";

export function ColoringCollectionsCatalog() {
  const { collections, isError, isPending, refetch } = useColoringCollectionsData();
  useTrackOpen(!isPending && !isError && Boolean(collections));

  if (isPending) {
    return (
      <section className="container py-10">
        <DataState
          title="Загружаем цифровые версии"
          description="Собираем доступные тематики Artmate."
        />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="container py-10">
        <DataState
          variant="error"
          title="Не удалось загрузить цифровые версии"
          description="Проверьте соединение и попробуйте ещё раз."
        />
        <div className="mt-4 flex justify-center">
          <Button type="button" className="min-h-11" onClick={() => void refetch()}>
            Повторить
          </Button>
        </div>
      </section>
    );
  }

  if (!collections || collections.length === 0) {
    return (
      <section className="container py-10">
        <DataState
          title="Тематики скоро появятся"
          description="Мы готовим первые цифровые версии раскрасок Artmate."
        />
      </section>
    );
  }

  return (
    <section className="container pb-12 md:pb-16" aria-label="Тематики цифровых раскрасок">
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-5">
        {collections.map((collection, index) => (
          <li key={collection.id}>
            <CollectionCover collection={collection} eager={index === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CollectionCover({
  collection,
  eager,
}: {
  collection: ColoringCollectionSummary;
  eager: boolean;
}) {
  return (
    <Link
      href={routes.coloringCollection(collection.slug)}
      aria-label={`Открыть тематику «${collection.title}»`}
      className="group relative block pt-0.5 pr-1.5 pb-2 pl-2.5 focus-visible:ring-3 focus-visible:ring-rose-400 sm:pl-3"
    >
      <AspectRatio
        ratio={collection.cover.width / collection.cover.height}
        className="relative isolate"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 translate-x-1 translate-y-1.5 bg-stone-200 shadow-sm"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 translate-x-0.5 translate-y-0.5 bg-white ring-1 ring-stone-300"
        />
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 32 800"
          fill="none"
          preserveAspectRatio="none"
          className={cn(bindingClassName, "z-0")}
        >
          <use href="/digital-versions/spiral-binding.svg#binding-back" />
        </svg>
        <span className="absolute inset-0 z-10 overflow-hidden bg-white shadow-sm ring-1 ring-stone-200 transition-shadow duration-300 group-hover:shadow-lg">
          <Image
            fill
            src={collection.cover.url}
            alt={collection.cover.alt}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : undefined}
            sizes={coverSizes}
            className="object-cover"
          />
        </span>
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 32 800"
          fill="none"
          preserveAspectRatio="none"
          className={cn(bindingClassName, "z-20")}
        >
          <use href="/digital-versions/spiral-binding.svg#binding-front" />
        </svg>
      </AspectRatio>
    </Link>
  );
}
