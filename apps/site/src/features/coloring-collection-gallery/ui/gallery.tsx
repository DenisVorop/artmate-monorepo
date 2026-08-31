"use client";

import Image from "next/image";

import { useColoringCollectionData } from "@/entities/coloring-collection";
import { routes } from "@/shared/constants";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardTitle,
  DataState,
  ExpandableText,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle, SectionSubtitle } from "@/shared/ui/typography";

type ColoringCollectionGalleryProps = {
  slug: string;
};

export function ColoringCollectionGallery({ slug }: ColoringCollectionGalleryProps) {
  const { collection, isError, isPending, refetch } = useColoringCollectionData(slug);

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
          <Button type="button" className="min-h-11" onClick={() => void refetch()}>
            Повторить
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.08),transparent_34rem)]">
      <section className="container space-y-6 py-5 md:space-y-8 md:py-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={routes.home}>Главная</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={routes.colorings}>Цифровые версии</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{collection.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="max-w-3xl space-y-3">
          <Badge variant="secondary" className="h-auto px-3 py-1.5 text-rose-700">
            {collection.coloringCount} из {collection.expectedColoringCount} иллюстраций
          </Badge>
          <PageTitle>{collection.title}</PageTitle>
          {collection.description ? (
            <ExpandableText collapsible>
              <SectionSubtitle>{collection.description}</SectionSubtitle>
            </ExpandableText>
          ) : null}
        </div>
      </section>

      <section
        className="container pb-12 md:pb-16"
        aria-label={`Иллюстрации «${collection.title}»`}
      >
        {collection.colorings.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {collection.colorings.map((coloring, index) => {
              const displayNumber = coloring.number;

              return (
                <li key={coloring.id} className="h-full">
                  <Link
                    href={routes.coloring(collection.slug, displayNumber)}
                    aria-label={`Открыть картину ${displayNumber}: ${coloring.title}`}
                    className="group block h-full rounded-xl focus-visible:ring-3 focus-visible:ring-rose-400 focus-visible:outline-none"
                  >
                    <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow duration-300 group-hover:shadow-md">
                      <div
                        className="relative overflow-hidden bg-muted"
                        style={{ aspectRatio: `${coloring.card.width} / ${coloring.card.height}` }}
                      >
                        <Image
                          fill
                          src={coloring.card.url}
                          alt={coloring.card.alt}
                          unoptimized
                          loading={index === 0 ? "eager" : "lazy"}
                          fetchPriority={index === 0 ? "high" : undefined}
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      </div>
                      <CardContent className="flex items-start gap-2.5 px-3 py-3 sm:px-4">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                          {displayNumber}
                        </span>
                        <CardTitle
                          role="heading"
                          aria-level={2}
                          className="pt-0.5 text-sm leading-snug text-stone-900 sm:text-base"
                        >
                          {coloring.title}
                        </CardTitle>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
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
