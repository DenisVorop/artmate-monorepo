"use client";

import Image from "next/image";

import {
  type ColoringCollectionSummary,
  useColoringCollectionsData,
} from "@/entities/coloring-collection";
import { routes } from "@/shared/constants";
import { AspectRatio, Button, DataState } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { useTrackOpen } from "../lib/use-track-open";

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
      <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
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
      className="group block overflow-hidden rounded-2xl bg-muted shadow-sm ring-1 ring-stone-200 transition-shadow duration-300 hover:shadow-lg focus-visible:ring-3 focus-visible:ring-rose-400"
    >
      <AspectRatio ratio={3 / 4} className="relative">
        <Image
          fill
          src={collection.cover.url}
          alt={collection.cover.alt}
          unoptimized
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"
        />
      </AspectRatio>
    </Link>
  );
}
